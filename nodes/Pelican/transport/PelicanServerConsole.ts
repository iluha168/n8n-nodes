import { WebSocket } from 'ws';
import { Blob } from 'node:buffer';
import type { Logger } from "n8n-workflow";
import { Observable } from "./Observable";
import type { ServerAction } from "./ServerAction";

function memoizeForever<A extends unknown[], R>(
	key: (...args: [...A]) => string
) {
	return function (target: (...args: A) => R, descriptor: ClassMethodDecoratorContext<object, typeof target>) {
		descriptor.addInitializer(function () {
			const memo = new Map<string, R>()
			Reflect.set(this, descriptor.name, function (this: object, ...args: A): R {
				const k = key(...args)
				if (memo.has(k)) {
					return memo.get(k)!
				}
				const result = target.apply(this, args)
				memo.set(k, result)
				return result
			})
		})
	};
}

function oneAtATime<A extends unknown[], R>(
	target: (...args: A) => Promise<R>,
	descriptor: ClassMethodDecoratorContext<object, typeof target>
) {
	descriptor.addInitializer(function () {
		let currentPromise: Promise<R> | undefined
		Reflect.set(this, descriptor.name, function (this: object, ...args: A): Promise<R> {
			return currentPromise ??= target
				.apply(this, args)
				.finally(() => currentPromise = undefined)
		})
	})
}

function debounce<A extends unknown[]>(delay: number, forceFlushAfter: number) {
	return function (target: (...args: A) => void, descriptor: ClassMethodDecoratorContext<object, typeof target>) {
		descriptor.addInitializer(function () {
			let timer: NodeJS.Timeout | undefined
			let forceTimer: NodeJS.Timeout | undefined
			Reflect.set(this, descriptor.name, function (this: object, ...args: A): void {
				timer ??= setTimeout(() => {
					timer = undefined
					forceTimer?.close()
					forceTimer = undefined
					target.apply(this, args)
				}, delay)
				timer.refresh()

				forceTimer ??= setTimeout(() => {
					timer?._onTimeout()
					timer?.close()
				}, forceFlushAfter)
			})
		})
	};
}

export type Status = 'stopping' | 'offline' | 'starting' | 'running';

type EventServerbound =
	| {
			event: 'auth';
			args: [token: string];
	}
	| {
			event: 'send command';
			args: [command: string];
	}
	| {
			event: 'send logs' | 'send stats';
			args: [null: null];
	}
	| {
			event: 'set state';
			args: [action: ServerAction];
	};

type EventClientbound =
	| {
			event: 'auth success' | 'token expiring' | 'token expired';
			args: never;
	}
	| {
			event: 'jwt error';
			args: [message: string];
	}
	| {
			event: 'console output' | 'install output';
			args: [console: string];
	}
	| {
			event: 'status';
			args: [status: Status];
	}
	| {
			event: 'stats';
			args: [jsonInfo: string];
	};

export type Stats = {
	cpu_absolute: number,
	disk_bytes: number,
	memory_bytes: number,
	memory_limit_bytes: number,
	network: {
		rx_bytes: number,
		tx_bytes: number
	},
	state: Status,
	uptime: number
}

export type PelicanServerConsoleEvents = {
	console: [console: { console: string }];
	status: [status: { status: Status }];
	stats: [stats: Stats];
}

export class PelicanServerConsole extends Observable<PelicanServerConsoleEvents> {
	@memoizeForever((serverID, baseUrl) => `${serverID}-${baseUrl}`)
	static create(serverID: string, baseUrl: URL, headers: HeadersInit, logger: Logger): PelicanServerConsole {
		return new PelicanServerConsole(serverID, baseUrl, headers, logger)
	}

	private constructor(
		private readonly serverID: string,
		private readonly baseUrl: URL,
		private readonly headers: HeadersInit,
		private readonly logger: Logger
	) {
		super()
		this.ensureConnection()
	}

	private conn?: WebSocket

	@oneAtATime
	private async fetchJWT(): Promise<{ url: string, jwt: string }> {
		const res = await fetch(`${this.baseUrl}api/client/servers/${this.serverID}/websocket`, { headers: this.headers });
		const body: unknown = await res.json();
		if (!res.ok) {
			throw new Error('Failed to GET websocket url', { cause: body });
		}
		if (!(
			typeof body === 'object' && body !== null && 'data' in body &&
			typeof body.data === 'object' && body.data !== null &&
			'token' in body.data && typeof body.data.token === 'string' &&
			'socket' in body.data && typeof body.data.socket === 'string'
		)) {
			throw new Error('Invalid response format', { cause: body });
		}
		return {
			url: body.data.socket,
			jwt: body.data.token,
		};
	}

	@oneAtATime
	private async ensureConnection(): Promise<WebSocket> {
		if (this.conn?.readyState === WebSocket.OPEN) {
			return this.conn;
		}
		const { url, jwt } = await this.fetchJWT();
		const ws = new WebSocket(url, {
			headers: {
				origin: this.baseUrl.origin,
			},
		});
		await new Promise<void>((resolve, reject) => {
			ws.onopen = () => this
				.send('auth', ws, jwt)
				.catch(reject)

			ws.onmessage = async ({ data }) => {
				const { event, args } = (await new Blob(Array.isArray(data) ? data : [data])
				.text()
				.then(JSON.parse)) as EventClientbound;

				switch (event) {
					case 'console output':
					case 'install output': {
						if (this.currentDirtyConsole.push(args[0]) > PelicanServerConsole.MAX_STORED_CONSOLE_ENTRIES) {
							this.currentDirtyConsole.shift()
						}
						this.markConsoleDirty()
						break;
					} case 'auth success':
						resolve();
						this.send('send logs', ws, null);
						this.send('send stats', ws, null);
						break;
					case 'token expiring':
					case 'token expired':
					case 'jwt error':
						this.send('auth', ws, (await this.fetchJWT()).jwt);
						break;
					case 'status':
						this.emit('status', { status: args[0] });
						break;
					case 'stats':
						this.emit('stats', JSON.parse(args[0]));
						break;
					default:
						this.logger.warn('Received unknown event from Pelican server console', { event, args });
				}
			}

			ws.onerror = ws.onclose = async (err: unknown) => {
				this.logger.warn('Websocket connection to Pelican server console closed, will attempt to reconnect', { error: err });
				delete this.conn;
				reject(err)
				await new Promise(r => setTimeout(r, 3000));
				this.ensureConnection();
			}
		})
		return this.conn = ws;
	}

	private async send<Event extends EventServerbound['event']>(
		event: Event,
		ws: WebSocket | PromiseLike<WebSocket> = this.ensureConnection(),
		...args: (EventServerbound & { event: Event })['args']
	) {
		(await ws).send(JSON.stringify({ event, args }));
	}


	static readonly MAX_STORED_CONSOLE_ENTRIES = 100
	/**
	 * Remembers past console entries, for which the entries have been emitted.
	 * Number of max entries is limited.
	 */
	private lastSeenConsole: string[] = []
	/**
	 * Remembers console entries that have not yet been processed. This is used to deduplicate console entries on reconnects.
	 * This consists of `[...latest`{@linkcode lastSeenConsole}``entries, ...newEntries]`.
	 * Number of max entries is limited.
	 */
	private currentDirtyConsole: string[] = []

	@debounce(300, 10000)
	private markConsoleDirty() {
		if (this.lastSeenConsole.length === 0) {
			// Do not emit anything, the console just initialized and received all the past entries, and we do not log the past entries
			this.lastSeenConsole = this.currentDirtyConsole.slice();
			return
		}

		function sameTails<T>(a: T[], b: T[]): boolean {
			for (let i = 1; i < Math.min(a.length, b.length); i++) {
				if (a.at(-i) !== b.at(-i)) return false;
			}
			return true;
		}

		let i = 0
		for (; i < this.currentDirtyConsole.length; i++) {
			if (sameTails(this.currentDirtyConsole.slice(0, -i || undefined), this.lastSeenConsole)) {
				break;
			}
		}

		// All entries before and at `i` are the same
		for (const console of i ? this.currentDirtyConsole.slice(-i) : []) {
			this.emit('console', { console });
		}
		this.lastSeenConsole = this.currentDirtyConsole.slice();
		return
	}

	public command(command: string) {
		return this.send('send command', undefined, command);
	}

	public power(action: ServerAction) {
		return this.send('set state', undefined, action);
	}
}

import { WebSocket, EventEmitter } from "ws"
import { Blob } from "node:buffer"

const getPelicanServerMemo = new Map<string, PelicanServer>()

export async function getPelicanServer(baseUrl: URL, serverID: string, headers: HeadersInit): Promise<PelicanServer> {
	{
		const existingServer = getPelicanServerMemo.get(serverID)
		if (existingServer) {
			return existingServer
		}
	}

	const getJWT = async () => {
		const res = await fetch(`${baseUrl}api/client/servers/${serverID}/websocket`, { headers })
		const body: { data: { token: string, socket: string } } = await res.json()
		if (!res.ok) {
			throw new Error("Failed to GET websocket url", { cause: body })
		}
		return {
			url: body.data.socket,
			jwt: body.data.token
		}
	}

	const { jwt, url } = await getJWT()

	const ws = new WebSocket(url, {
		headers: {
			origin: baseUrl.origin,
		},
	})
	const server = new PelicanServer(
		ws,
		async () => (await getJWT()).jwt
	)

	ws.once('open', () => {
		server.send('auth', jwt)
	})

	await new Promise<void>((resolve, reject) => {
		server.once('disconnected', () => {
			reject()
			getPelicanServerMemo.delete(serverID)
		})
		server.once('connected', resolve)
	})

	getPelicanServerMemo.set(serverID, server)
	return server
}

type ServerAction = "start" | "stop" | "restart" | "kill"
type Status = "stopping" | "offline" | "starting" | "running"

type EventServerbound = {
	event: "send command" | "auth"
	args: [token: string]
} | {
	event: "send logs" | "send stats"
	args: [null: null]
} | {
	event: "set state"
	args: [action: ServerAction]
}

type EventClientbound = {
	event: "auth success" | "token expiring" | "token expired"
	args: never
} | {
	event: "console output" | "install output"
	args: [console: string]
} | {
	event: "status"
	args: [status: Status]
} | {
	event: "stats"
	args: [jsonInfo: string]
}

export class PelicanServer extends EventEmitter<{
	connected: []
	disconnected: []
	console: [console: { console: string }]
	status: [status: { status: Status }]
	stats: [stats: any]
}> {
	constructor(
		protected ws: WebSocket,
		getJWT: () => Promise<string>,
	) {
		super()
		ws.on('close', () => this.emit('disconnected'))
		ws.on('message', async (msg) => {
			const { event, args } = await new Blob(Array.isArray(msg) ? msg : [msg])
				.text()
				.then(JSON.parse) as EventClientbound

			switch (event) {
				case "console output":
				case "install output":
					this.emit('console', { console: args[0] })
					break
				case "auth success":
					this.emit('connected')
					this.send("send logs", null)
					this.send("send stats", null)
					break
				case "token expiring":
				case "token expired":
					this.send("auth", await getJWT())
					break
				case "status":
					this.emit('status', { status: args[0] })
					break
				case "stats":
					this.emit('stats', JSON.parse(args[0]))
					break
				default:
					console.warn("[Pelican] Unknown message type. Report this to the package maintainers.", { event, args })
			}
		})
	}

	public send<Event extends EventServerbound['event']>(
		event: Event,
		...args: (EventServerbound & { event: Event })['args']
	) {
		this.ws.send(JSON.stringify({ event, args }))
	}
}

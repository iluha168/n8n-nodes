import {
	NodeApiError,
	type INodeType,
	type INodeTypeDescription,
	type ITriggerFunctions,
	type ITriggerResponse,
} from 'n8n-workflow';
import { getPelicanServer } from './transport/PelicanServer';

export class PelicanTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pelican Trigger',
		name: 'pelicanTrigger',
		group: ['trigger'],
		version: 1,
		subtitle: '={{ $parameter.server + ": " + $parameter.operation }}',
		description: 'Pelican',
		defaults: {
			name: 'Pelican',
		},
		inputs: [],
		outputs: ['main'],
		icon: 'file:pelican.svg',
		usableAsTool: true,

		credentials: [{
			name: "pelicanApi",
			required: true,
		}],

		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				default: 'client',
				options: [{
					name: 'Client',
					value: 'client',
				}],
				required: true,
				noDataExpression: true,
			},
			{
				displayName: 'Server Short UUID',
				name: 'server',
				type: 'string',
				default: '',
				placeholder: 'e.g 5a123cd4',
				required: true,
				displayOptions: {
					show: {
						resource: ['client'],
					}
				},
			},
			{
				displayName: 'Event',
				name: 'operation',
				type: 'options',
				default: 'console',
				displayOptions: {
					show: {
						resource: ['client'],
					}
				},
				options: [{
					name: "Console",
					value: "console",
					action: 'On new console message',
				}, {
					name: "Status",
					value: "status",
					action: 'On server stopping running etc',
				}, {
					name: "Stats",
					value: "stats",
					action: 'On resource statistics update',
				}],
				required: true,
				noDataExpression: true,
			},
		],
	}

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const credentials = await this.getCredentials<({
			type: "cookies"
			cookies: string
		} | {
			type: "key"
			key: string
		}) & {
			url: string
		}>('pelicanApi')

		const headers: HeadersInit = {
			accept: "application/json"
		}
		switch(credentials.type) {
			case 'cookies':
				headers.cookies = credentials.cookies
				break
			case 'key':
				headers.authorization = "Bearer " + credentials.key
				break
			default:
				throw new NodeApiError(this.getNode(), {}, { message: "Unknown credential type" })
		}

		try {
			const server = await getPelicanServer(
				new URL(credentials.url),
				this.getNodeParameter("server") as string,
				headers
			)
			server.once('disconnected', () => this.emitError(new Error("Connection closed")))

			const operation = this.getNodeParameter("operation") as "console" | "status" | "stats"
			const callback = (data: any) => this.emit([
				this.helpers.returnJsonArray([data])
			])
			server.on(operation, callback)
			return {
				async closeFunction() {
					server.off(operation, callback)
				}
			};
		} catch(error) {
			throw new NodeApiError(this.getNode(), { error })
		}
	}
}

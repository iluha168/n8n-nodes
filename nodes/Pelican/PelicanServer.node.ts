import {
	NodeApiError,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { asServerAction, getPelicanServer, type ServerAction } from './transport/PelicanServer';
import { parseCredentials } from './transport/parseCredentials';

export class PelicanServer implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pelican Server',
		name: 'pelicanServer',
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter.server + ": " + $parameter.operation }}',
		description: 'Interact with a Pelican server',
		defaults: {
			name: 'Pelican Server',
		},
		inputs: ['main'],
		outputs: ['main'],
		icon: 'file:pelican.svg',
		usableAsTool: true,

		credentials: [
			{
				name: 'pelicanApi',
				required: true,
			},
		],

		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				default: 'client',
				options: [
					{
						name: 'Client',
						value: 'client',
					},
				],
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
					},
				},
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'set_state',
				displayOptions: {
					show: {
						resource: ['client'],
					},
				},
				options: [
					{
						name: 'Send Command',
						value: 'send_command',
						action: 'Issue a command with the server console',
					},
					{
						name: 'Set Power State',
						value: 'set_state',
						action: 'Control power state of the server',
					},
				],
				required: true,
				noDataExpression: true,
			},
			{
				displayName: 'Command',
				name: 'command',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['send_command'],
					},
				},
			},
			{
				displayName: 'State',
				name: 'state',
				type: 'options',
				default: '',
				displayOptions: {
					show: {
						operation: ['set_state'],
					},
				},
				options: [
					{
						name: 'Start',
						value: 'start',
					},
					{
						name: 'Stop',
						value: 'stop',
					},
					{
						name: 'Restart',
						value: 'restart',
					},
					{
						name: 'Kill',
						value: 'kill',
					},
				] satisfies { name: string; value: ServerAction }[],
				required: true,
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const { url, headers } = await parseCredentials(this);

		for (const itemIndex of this.getInputData().keys()) {
			try {
				const server = await getPelicanServer(
					url,
					this.getNodeParameter('server', itemIndex) as string,
					headers,
				);

				const operation = this.getNodeParameter('operation', itemIndex) as string;
				switch (operation) {
					case 'send_command':
						server.send('send command', this.getNodeParameter('command', itemIndex) as string);
						break;
					case 'set_state':
						server.send(
							'set state',
							asServerAction(this.getNodeParameter('state', itemIndex) as string),
						);
						break;
				}
			} catch (error) {
				throw new NodeApiError(this.getNode(), { json: { ok: false }, error });
			}
		}

		return [
			this.helpers.returnJsonArray(Array(this.getInputData().length).fill({ json: { ok: true } })),
		];
	}
}

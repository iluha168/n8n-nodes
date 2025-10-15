import {
	NodeApiError,
	NodeOperationError,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import {
	asServerAction,
	getPelicanServer,
	type ServerAction,
	type Status,
} from './transport/PelicanServer';
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
					{
						name: 'Wait Power State',
						value: 'wait_state',
						action: 'Wait for a certain power state of the server',
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
			{
				displayName: 'Status',
				name: 'status',
				type: 'multiOptions',
				default: [],
				displayOptions: {
					show: {
						operation: ['wait_state'],
					},
				},
				options: [
					{
						name: 'Starting',
						value: 'starting',
					},
					{
						name: 'Stopping',
						value: 'stopping',
					},
					{
						name: 'Running',
						value: 'running',
					},
					{
						name: 'Offline',
						value: 'offline',
					},
				] satisfies { name: string; value: Status }[],
				required: true,
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const { url, headers } = await parseCredentials(this);

		const returnData: INodeExecutionData[] = [];

		for (const itemIndex of this.getInputData().keys()) {
			try {
				const getServer = () =>
					getPelicanServer(url, this.getNodeParameter('server', itemIndex) as string, headers);
				let server = await getServer();

				const operation = this.getNodeParameter('operation', itemIndex) as string;
				switch (operation) {
					case 'send_command':
						server.send('send command', this.getNodeParameter('command', itemIndex) as string);
						returnData.push({ json: { ok: true } });
						break;
					case 'set_state':
						server.send(
							'set state',
							asServerAction(this.getNodeParameter('state', itemIndex) as string),
						);
						returnData.push({ json: { ok: true } });
						break;
					case 'wait_state': {
						const desiredStatuses = this.getNodeParameter('status', itemIndex) as Status[];
						const foundStatus = await new Promise<Status>((res, rej) => {
							const onStatus = ({ status }: { status: Status }) => {
								if (desiredStatuses.includes(status)) {
									server.off('status', onStatus);
									res(status);
								}
							};
							server.on('status', onStatus);
							server.on('disconnected', () => {
								rej("Abrupt disconnection from Pelican. Try 'retry on fail' mode?");
							});
						});
						returnData.push({ json: { ok: true, status: foundStatus } });
						break;
					}
					default:
						throw new NodeOperationError(this.getNode(), `Unknown operation: '${operation}'`);
				}
			} catch (error) {
				throw new NodeApiError(this.getNode(), { json: { ok: false }, error });
			}
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
}

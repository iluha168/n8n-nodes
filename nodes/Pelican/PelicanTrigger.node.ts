import {
	NodeApiError, type INodeType,
	type INodeTypeDescription,
	type ITriggerFunctions,
	type ITriggerResponse
} from 'n8n-workflow';
import { PelicanServerConsole, type PelicanServerConsoleEvents } from './transport/PelicanServerConsole';
import { parseCredentials } from './transport/parseCredentials';

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
		icon: 'file:../../icons/pelican.svg',
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
				displayName: 'Event',
				name: 'operation',
				type: 'options',
				default: 'console',
				displayOptions: {
					show: {
						resource: ['client'],
					},
				},
				options: [
					{
						name: 'Console',
						value: 'console',
						action: 'On new console message',
					},
					{
						name: 'Status',
						value: 'status',
						action: 'On server stopping running etc',
					},
					{
						name: 'Stats',
						value: 'stats',
						action: 'On resource statistics update',
					},
				] satisfies { name: string, value: keyof PelicanServerConsoleEvents, action: string }[],
				required: true,
				noDataExpression: true,
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const { url, headers } = await parseCredentials(this);
		try {
			const server = PelicanServerConsole.create(
				this.getNodeParameter('server') as string,
				url, headers, this.logger
			);

			const controller = new AbortController();
			server.on(
				this.getNodeParameter('operation') as keyof PelicanServerConsoleEvents,
				data => this.emit([this.helpers.returnJsonArray([data])]),
				controller.signal
			);

			return {
				closeFunction: async () => controller.abort(),
			};
		} catch (error) {
			throw new NodeApiError(this.getNode(), { error });
		}
	}
}

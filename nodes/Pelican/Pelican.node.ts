import type { INodeType, INodeTypeDescription } from 'n8n-workflow';

export class Pelican implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pelican',
		name: 'pelican',
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Pelican',
		defaults: {
			name: 'Pelican',
		},
		inputs: ['main'],
		outputs: ['main'],
		icon: 'file:../../icons/pelican.svg',
		usableAsTool: true,

		credentials: [
			{
				name: 'pelicanApi',
				required: true,
			},
		],

		requestDefaults: {
			baseURL: '={{ $credentials.url }}',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},

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
					{
						name: 'Application',
						value: 'application',
					},
				],
				required: true,
				noDataExpression: true,
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'get-own-profile',
				displayOptions: {
					show: {
						resource: ['client'],
					},
				},
				options: [
					{
						name: 'Get Own Profile',
						action: 'Get own profile',
						value: 'get-own-profile',
						hint: 'http://demo.pelican.dev/docs/api/client#/operations/api:client.account',
						routing: {
							request: {
								url: '/api/client/account',
							},
						},
					},
					{
						name: 'Get Servers',
						action: 'Get servers list',
						value: 'get-servers-client',
						hint: 'https://demo.pelican.dev/docs/api/client#/operations/api:client.index',
						routing: {
							request: {
								url: '/api/client/',
							},
						},
					},
				],
				required: true,
				noDataExpression: true,
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'get-users',
				displayOptions: {
					show: {
						resource: ['application'],
					},
				},
				options: [
					{
						name: 'Get Users',
						action: 'Get users list',
						value: 'get-users',
						hint: 'https://demo.pelican.dev/docs/api/application#/operations/application.users',
						routing: {
							request: {
								url: '/api/application/users/',
							},
						},
					},
					{
						name: 'Get Servers',
						action: 'Get servers list',
						value: 'get-servers-application',
						hint: 'https://demo.pelican.dev/docs/api/application#/operations/application.servers',
						routing: {
							request: {
								url: '/api/application/servers/',
							},
						},
					},
				],
				required: true,
				noDataExpression: true,
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['get-servers-client'],
					},
				},
				routing: {
					request: {
						qs: {
							type: '={{ $value }}',
						},
					},
				},
				required: true,
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				default: {},
				placeholder: 'Add Field',
				displayOptions: {
					show: {
						operation: ['get-servers-application'],
					},
				},
				options: [
					{
						displayName: 'Search',
						name: 'search',
						type: 'string',
						default: '',
						routing: {
							request: {
								qs: {
									search: '={{ $value }}',
								},
							},
						},
					},
				],
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				default: {},
				placeholder: 'Add Field',
				displayOptions: {
					show: {
						operation: ['get-servers-client'],
					},
				},
				options: [
					{
						displayName: 'Number Per Page',
						name: 'per-page',
						type: 'number',
						default: 50,
						routing: {
							request: {
								qs: {
									per_page: '={{ $value }}',
								},
							},
						},
					},
				],
			},
		],
	};
}

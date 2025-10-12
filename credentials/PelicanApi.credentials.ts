import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class PelicanApi implements ICredentialType {
	name = 'pelicanApi';
	displayName = 'Pelican API';

	documentationUrl = 'https://demo.pelican.dev/docs/api';

	properties: INodeProperties[] = [
		{
			displayName: 'Panel URL',
			name: 'url',
			default: '',
			type: 'string',
			placeholder: 'e.g. https://demo.pelican.dev/',
			required: true,
		},
		{
			displayName: 'Type',
			name: 'type',
			default: 'key',
			type: 'options',
			options: [{
				name: 'Key',
				value: 'key',
			}, {
				name: 'Cookies',
				value: 'cookies',
			}],
			required: true,
		},
		// TODO api key
		{
			displayName: 'Cookies',
			name: 'cookies',
			default: '',
			type: 'string',
			typeOptions: { password: true },
			displayOptions: { show: { type: ['cookies'] } },
			placeholder: 'remember_web_xxxxxxxx=xxxxxxxx; pelican_session=xxxxxxxx',
			required: true,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'cookie': '={{ $credentials.cookies }}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{ $credentials.url }}',
			url: '/api/client/account',
		},
	};
}

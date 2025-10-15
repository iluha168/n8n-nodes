import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DiscordUserApi implements ICredentialType {
	name = 'discordUserApi';
	displayName = 'Discord User API';
	icon = 'node:n8n-nodes-discord-selfbot.discordTrigger' as const;

	documentationUrl = 'https://discordjs-self-v13.netlify.app/#/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'Token',
			name: 'token',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{ $credentials.token }}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://discord.com/api/v9/',
			url: 'users/@me',
		},
	};
}

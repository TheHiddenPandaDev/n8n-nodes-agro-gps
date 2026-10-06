import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class AgroGpsApi implements ICredentialType {
	name = 'agroGpsApi';

	displayName = 'Agro GPS API';

	icon: Icon = { light: 'file:../icons/agro-gps.svg', dark: 'file:../icons/agro-gps.dark.svg' };

	documentationUrl = 'https://github.com/TheHiddenPandaDev/n8n-nodes-agro-gps#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'Agro GPS key starting with agk_. Create it in the Agro GPS app under Settings > API and webhooks. A read key lists data; a write key can also register operations and create fields.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.agrogps.eu',
			url: '/api/v1/farms',
			method: 'GET',
		},
	};
}

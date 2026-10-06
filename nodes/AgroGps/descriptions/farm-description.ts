import type { INodeProperties } from 'n8n-workflow';

export const farmOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['farm'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the farms the API key can access',
				action: 'Get many farms',
			},
		],
		default: 'getAll',
	},
];

import type { INodeProperties } from 'n8n-workflow';
import { DEFAULT_COUNTRY } from '../shared/constants';
import { countryOptions } from './shared-fields';

const forField = { resource: ['field'] };

export const fieldOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: forField },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a field in the farm diary from a polygon (needs a write key)',
				action: 'Create a field',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the fields of a farm with crop and surface',
				action: 'Get many fields',
			},
		],
		default: 'getAll',
	},
];

export const fieldFields: INodeProperties[] = [
	{
		displayName: 'Farm ID',
		name: 'farmId',
		type: 'string',
		default: '',
		description: 'Farm UUID. Leave empty to use the first farm of the key.',
		displayOptions: { show: forField },
	},
	{
		displayName: 'Include Geometry',
		name: 'includeGeometry',
		type: 'boolean',
		default: false,
		description: 'Whether to add the field outline as [latitude, longitude] points',
		displayOptions: { show: { ...forField, operation: ['getAll'] } },
	},
	{
		displayName: 'Field Name',
		name: 'fieldName',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. North barley',
		displayOptions: { show: { ...forField, operation: ['create'] } },
	},
	{
		displayName: 'Country',
		name: 'country',
		type: 'options',
		options: countryOptions(),
		default: DEFAULT_COUNTRY,
		displayOptions: { show: { ...forField, operation: ['create'] } },
	},
	{
		displayName: 'Crop (EPPO Code)',
		name: 'cropCode',
		type: 'string',
		default: '',
		placeholder: 'e.g. HORVW',
		displayOptions: { show: { ...forField, operation: ['create'] } },
	},
	{
		displayName: 'Polygon',
		name: 'polygon',
		type: 'json',
		required: true,
		default: '[[41.6, 1.8], [41.601, 1.8], [41.601, 1.802], [41.6, 1.802]]',
		description:
			'Outline as [[latitude, longitude], …] or a GeoJSON Polygon/Feature (GeoJSON uses [longitude, latitude])',
		displayOptions: { show: { ...forField, operation: ['create'] } },
	},
];

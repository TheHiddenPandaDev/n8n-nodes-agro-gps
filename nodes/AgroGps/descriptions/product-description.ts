import type { INodeProperties } from 'n8n-workflow';
import { DEFAULT_COUNTRY } from '../shared/constants';
import { countryOptions } from './shared-fields';

const forProduct = { resource: ['product'] };

export const productOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: forProduct },
		options: [
			{
				name: 'Get',
				value: 'get',
				description:
					'Get a plant protection product by registration number, with its authorised uses and conditions of use',
				action: 'Get a plant protection product',
			},
			{
				name: 'Search',
				value: 'search',
				description: 'Search plant protection products by name in a country register',
				action: 'Search plant protection products',
			},
		],
		default: 'get',
	},
];

export const productFields: INodeProperties[] = [
	{
		displayName: 'Registration Number',
		name: 'registrationNumber',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 25421',
		description: 'Official registration or authorisation number of the product in its country',
		displayOptions: { show: { ...forProduct, operation: ['get'] } },
	},
	{
		displayName: 'Product Name',
		name: 'productName',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. Karate',
		description: 'At least three letters of the commercial name',
		displayOptions: { show: { ...forProduct, operation: ['search'] } },
	},
	{
		displayName: 'Country',
		name: 'country',
		type: 'options',
		options: countryOptions(),
		default: DEFAULT_COUNTRY,
		description: 'Country whose official register is used',
		displayOptions: { show: forProduct },
	},
	{
		displayName: 'Crop (EPPO Code)',
		name: 'cropCode',
		type: 'string',
		default: '',
		placeholder: 'e.g. TRZAW',
		description: 'Optional EPPO crop code to keep only the uses authorised for that crop',
		displayOptions: { show: { ...forProduct, operation: ['get'] } },
	},
	{
		displayName: 'Split Uses Into Items',
		name: 'splitUses',
		type: 'boolean',
		default: false,
		description: 'Whether to output one item per authorised use instead of one item per product',
		displayOptions: { show: { ...forProduct, operation: ['get'] } },
	},
];

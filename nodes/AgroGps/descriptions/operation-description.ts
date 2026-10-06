import type { INodeProperties } from 'n8n-workflow';
import { DEFAULT_COUNTRY } from '../shared/constants';
import { countryOptions, entryTypeOptions } from './shared-fields';

const forOperation = { resource: ['operation'] };

export const operationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: forOperation },
		options: [
			{
				name: 'Register',
				value: 'register',
				description: 'Register a farm operation in the diary, e.g. a treatment or a harvest (needs a write key)',
				action: 'Register a farm operation',
			},
		],
		default: 'register',
	},
];

export const operationFields: INodeProperties[] = [
	{
		displayName: 'Farm ID',
		name: 'farmId',
		type: 'string',
		default: '',
		description: 'Farm UUID. Leave empty to use your default farm.',
		displayOptions: { show: forOperation },
	},
	{
		displayName: 'Field Reference',
		name: 'fieldReference',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 45098A01300012',
		description: 'Cadastral or agricultural reference of the field, or the ID shown by Field > Get Many',
		displayOptions: { show: forOperation },
	},
	{
		displayName: 'Type',
		name: 'operationType',
		type: 'options',
		options: entryTypeOptions(),
		default: 'treatment',
		displayOptions: { show: forOperation },
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. Fungicide on wheat',
		displayOptions: { show: forOperation },
	},
	{
		displayName: 'Date',
		name: 'date',
		type: 'dateTime',
		required: true,
		default: '',
		description: 'When the operation was done. Future dates are rejected.',
		displayOptions: { show: forOperation },
	},
	{
		displayName: 'Country',
		name: 'country',
		type: 'options',
		options: countryOptions(),
		default: DEFAULT_COUNTRY,
		description: 'Country of the farm, used when a default farm has to be created',
		displayOptions: { show: forOperation },
	},
	{
		displayName: 'Quantity',
		name: 'quantity',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0 },
		description: 'Dose or amount, e.g. litres per hectare for a treatment',
		displayOptions: { show: forOperation },
	},
	{
		displayName: 'Unit',
		name: 'unit',
		type: 'string',
		default: '',
		placeholder: 'e.g. l/ha',
		displayOptions: { show: forOperation },
	},
	{
		displayName: 'Product Registration Number',
		name: 'registrationNumber',
		type: 'string',
		default: '',
		description: 'Registration number of the plant protection product, for treatments',
		displayOptions: { show: forOperation },
	},
	{
		displayName: 'Safety Days',
		name: 'safetyDays',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0 },
		description: 'Pre-harvest interval in days, for treatments',
		displayOptions: { show: forOperation },
	},
	{
		displayName: 'Operation ID',
		name: 'operationId',
		type: 'string',
		default: '',
		description:
			'Optional UUID. Reuse the same one to avoid duplicates when a workflow runs twice; leave empty to generate one.',
		displayOptions: { show: forOperation },
	},
];

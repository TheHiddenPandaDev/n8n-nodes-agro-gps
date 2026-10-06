import { randomUUID } from 'crypto';
import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestOptions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type JsonObject,
} from 'n8n-workflow';
import { farmOperations } from './descriptions/farm-description';
import { fieldFields, fieldOperations } from './descriptions/field-description';
import { operationFields, operationOperations } from './descriptions/operation-description';
import { productFields, productOperations } from './descriptions/product-description';
import { CREDENTIAL_NAME } from './shared/constants';
import { AgroGpsInputError } from './shared/input-error';
import {
	AgroGpsApiError,
	AUTHENTICATED_RESOURCES,
	runOperation,
	type FullResponse,
	type Runtime,
} from './shared/operation-runner';

export class AgroGps implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Agro GPS',
		name: 'agroGps',
		icon: { light: 'file:../../icons/agro-gps.svg', dark: 'file:../../icons/agro-gps.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Farm diary: register operations, check plant protection products and their conditions, list and create fields',
		defaults: {
			name: 'Agro GPS',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: CREDENTIAL_NAME,
				required: true,
				displayOptions: { show: { resource: AUTHENTICATED_RESOURCES } },
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Farm', value: 'farm' },
					{ name: 'Field', value: 'field' },
					{ name: 'Operation', value: 'operation' },
					{ name: 'Plant Protection Product', value: 'product' },
				],
				default: 'operation',
			},
			...operationOperations,
			...operationFields,
			...productOperations,
			...productFields,
			...fieldOperations,
			...fieldFields,
			...farmOperations,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const runtime: Runtime = {
			authenticated: async (options: IHttpRequestOptions) =>
				(await this.helpers.httpRequestWithAuthentication.call(
					this,
					CREDENTIAL_NAME,
					options,
				)) as FullResponse,
			anonymous: async (options: IHttpRequestOptions) =>
				(await this.helpers.httpRequest(options)) as FullResponse,
			newId: () => randomUUID(),
			now: () => new Date(),
		};

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const read = (name: string) => this.getNodeParameter(name, itemIndex, '');
				const results = await runOperation(resource, operation, read, runtime);
				for (const json of results) {
					returnData.push({ json, pairedItem: { item: itemIndex } });
				}
			} catch (error) {
				const nodeError = toNodeError(this, error, itemIndex);
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: nodeError.message, description: nodeError.description ?? '' } as IDataObject,
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				throw nodeError;
			}
		}

		return [returnData];
	}
}

function toNodeError(
	context: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
): NodeApiError | NodeOperationError {
	if (error instanceof AgroGpsApiError) {
		return new NodeApiError(context.getNode(), (error.body ?? {}) as JsonObject, {
			message: error.details.message,
			description: error.details.description,
			httpCode: error.details.httpCode,
			itemIndex,
		});
	}
	if (error instanceof AgroGpsInputError) {
		return new NodeOperationError(context.getNode(), error.message, { itemIndex });
	}
	if (error instanceof NodeApiError || error instanceof NodeOperationError) return error;
	return new NodeApiError(context.getNode(), error as JsonObject, { itemIndex });
}

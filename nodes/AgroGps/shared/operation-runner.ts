import type { IDataObject, IHttpRequestOptions } from 'n8n-workflow';
import { describeApiError, type ApiErrorDescription } from './api-error';
import { DEFAULT_COUNTRY, MAX_RECORD_PAGES } from './constants';
import { AgroGpsInputError } from './input-error';
import {
	createFieldsRequest,
	farmsRequest,
	optionalText,
	parsePolygon,
	productRequest,
	productSearchRequest,
	recordsRequest,
	registerEntryRequest,
	requireCountry,
	requireFarmId,
} from './request-builder';
import {
	asObject,
	mapCreatedFields,
	mapEntryResults,
	mapFarms,
	mapField,
	mapMatches,
	mapProduct,
	parcelRecords,
	unwrapData,
} from './response-mapper';

export interface FullResponse {
	statusCode: number;
	body: unknown;
	headers?: Record<string, unknown>;
}

export type Transport = (options: IHttpRequestOptions) => Promise<FullResponse>;

export type ParameterReader = (name: string) => unknown;

export interface Runtime {
	authenticated: Transport;
	anonymous: Transport;
	newId: () => string;
	now: () => Date;
}

export class AgroGpsApiError extends Error {
	readonly details: ApiErrorDescription;

	readonly body: unknown;

	constructor(details: ApiErrorDescription, body: unknown) {
		super(details.message);
		this.name = 'AgroGpsApiError';
		this.details = details;
		this.body = body;
	}
}

const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;
const REJECTED_RESULT = 'rejected';

function headerNumber(headers: Record<string, unknown> | undefined, name: string): number | undefined {
	const raw = headers?.[name] ?? headers?.[name.toLowerCase()];
	const value = Number(Array.isArray(raw) ? raw[0] : raw);
	return Number.isFinite(value) && value > 0 ? value : undefined;
}

export async function send(transport: Transport, options: IHttpRequestOptions): Promise<unknown> {
	const response = await transport(options);
	if (response.statusCode < HTTP_OK_MIN || response.statusCode > HTTP_OK_MAX) {
		const retryAfter = headerNumber(response.headers, 'retry-after');
		throw new AgroGpsApiError(describeApiError(response.statusCode, response.body, retryAfter), response.body);
	}
	return unwrapData(response.body);
}

function numberOrUndefined(value: unknown): number | undefined {
	if (value === '' || value === undefined || value === null) return undefined;
	const number = Number(value);
	return Number.isFinite(number) ? number : Number.NaN;
}

async function resolveFarmId(read: ParameterReader, runtime: Runtime): Promise<string> {
	const given = requireFarmId(read('farmId'));
	if (given) return given;
	const farms = mapFarms(await send(runtime.authenticated, farmsRequest()));
	if (farms.length === 0) throw new AgroGpsInputError('This key has no farm yet. Create one in the Agro GPS app.');
	return String(farms[0].id);
}

async function fetchRecordPages(runtime: Runtime, farmId: string): Promise<unknown[]> {
	const pages: unknown[] = [];
	let since = 0;
	for (let count = 0; count < MAX_RECORD_PAGES; count += 1) {
		const page = asObject(await send(runtime.authenticated, recordsRequest(farmId, since)));
		pages.push(page);
		const next = Number(page.next);
		if (page.has_more !== true || !Number.isFinite(next) || next <= since) return pages;
		since = next;
	}
	throw new AgroGpsInputError(`The farm has more than ${MAX_RECORD_PAGES} pages of records`);
}

type Handler = (read: ParameterReader, runtime: Runtime) => Promise<IDataObject[]>;

const handlers: Record<string, Handler> = {
	'product:get': async (read, runtime) => {
		const data = await send(
			runtime.anonymous,
			productRequest(read('registrationNumber'), read('country'), read('cropCode')),
		);
		return mapProduct(data, read('splitUses') === true);
	},
	'product:search': async (read, runtime) => {
		const data = await send(runtime.anonymous, productSearchRequest(read('productName'), read('country')));
		return mapMatches(data);
	},
	'farm:getAll': async (_read, runtime) => mapFarms(await send(runtime.authenticated, farmsRequest())),
	'field:getAll': async (read, runtime) => {
		const farmId = await resolveFarmId(read, runtime);
		const records = parcelRecords(await fetchRecordPages(runtime, farmId));
		const includeGeometry = read('includeGeometry') === true;
		return records
			.map((record) => mapField(record, includeGeometry, farmId))
			.sort((a, b) => String(a.name).localeCompare(String(b.name)));
	},
	'field:create': async (read, runtime) => {
		const request = createFieldsRequest([
			{
				farmId: requireFarmId(read('farmId')),
				name: optionalText(read('fieldName')),
				country: requireCountry(read('country') || DEFAULT_COUNTRY),
				cropCode: optionalText(read('cropCode')).toUpperCase(),
				polygon: parsePolygon(read('polygon')),
			},
		]);
		return mapCreatedFields(await send(runtime.authenticated, request));
	},
	'operation:register': async (read, runtime) => {
		const id = optionalText(read('operationId')) || runtime.newId();
		const request = registerEntryRequest(
			{
				id,
				farmId: requireFarmId(read('farmId')),
				country: requireCountry(read('country') || DEFAULT_COUNTRY),
				parcelReference: optionalText(read('fieldReference')),
				entryType: optionalText(read('operationType')),
				title: optionalText(read('title')),
				eventAt: optionalText(read('date')),
				quantity: numberOrUndefined(read('quantity')),
				unit: optionalText(read('unit')),
				registrationNumber: optionalText(read('registrationNumber')),
				safetyDays: numberOrUndefined(read('safetyDays')),
			},
			runtime.now(),
		);
		const results = mapEntryResults(await send(runtime.authenticated, request));
		const rejected = results.find((result) => result.result === REJECTED_RESULT);
		if (rejected) {
			throw new AgroGpsInputError(
				'Agro GPS rejected the operation. Check the operation ID (a UUID), the type and that the date is not in the future.',
			);
		}
		return results;
	},
};

export const AUTHENTICATED_RESOURCES = ['farm', 'field', 'operation'];

export async function runOperation(
	resource: string,
	operation: string,
	read: ParameterReader,
	runtime: Runtime,
): Promise<IDataObject[]> {
	const handler = handlers[`${resource}:${operation}`];
	if (!handler) throw new AgroGpsInputError(`Unsupported operation: ${resource} / ${operation}`);
	return handler(read, runtime);
}

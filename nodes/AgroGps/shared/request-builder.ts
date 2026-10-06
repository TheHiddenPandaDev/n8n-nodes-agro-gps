import type { IDataObject, IHttpRequestMethods, IHttpRequestOptions } from 'n8n-workflow';
import {
	API_BASE_URL,
	COUNTRY_NAMES,
	ENTRY_TYPES,
	MAX_FIELDS_PER_IMPORT,
	MAX_SEARCH_LENGTH,
	MIN_POLYGON_POINTS,
	MIN_SEARCH_LENGTH,
} from './constants';
import { AgroGpsInputError } from './input-error';

type QueryValue = string | number | undefined;

const LATITUDE_LIMIT = 90;
const LONGITUDE_LIMIT = 180;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildRequest(
	method: IHttpRequestMethods,
	path: string,
	query: Record<string, QueryValue> = {},
	body?: IDataObject,
): IHttpRequestOptions {
	const qs: IDataObject = {};
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined && value !== '') qs[key] = value;
	}
	const options: IHttpRequestOptions = {
		method,
		url: `${API_BASE_URL}${path}`,
		qs,
		headers: { Accept: 'application/json' },
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};
	if (body) options.body = body;
	return options;
}

export function requireText(value: unknown, label: string): string {
	const text = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
	if (!text) throw new AgroGpsInputError(`${label} must not be empty`);
	return text;
}

export function optionalText(value: unknown): string {
	if (typeof value === 'number') return String(value);
	return typeof value === 'string' ? value.trim() : '';
}

export function requireCountry(value: unknown): string {
	const country = optionalText(value).toUpperCase();
	if (!COUNTRY_NAMES[country]) throw new AgroGpsInputError(`Unsupported country: ${country || '(empty)'}`);
	return country;
}

export function requireFarmId(value: unknown): string {
	const id = optionalText(value);
	if (id && !UUID_PATTERN.test(id)) throw new AgroGpsInputError('Farm ID must be a UUID, or empty for your default farm');
	return id;
}

export function productRequest(registration: unknown, country: unknown, crop: unknown): IHttpRequestOptions {
	const number = requireText(registration, 'Registration Number');
	return buildRequest('GET', `/api/public/phyto/${encodeURIComponent(number)}`, {
		country: requireCountry(country),
		crop: optionalText(crop).toUpperCase(),
	});
}

export function productSearchRequest(name: unknown, country: unknown): IHttpRequestOptions {
	const term = requireText(name, 'Product Name');
	if (term.length < MIN_SEARCH_LENGTH || term.length > MAX_SEARCH_LENGTH) {
		throw new AgroGpsInputError(`Product Name must have between ${MIN_SEARCH_LENGTH} and ${MAX_SEARCH_LENGTH} characters`);
	}
	return buildRequest('GET', '/api/public/phyto', { q: term, country: requireCountry(country) });
}

export function farmsRequest(): IHttpRequestOptions {
	return buildRequest('GET', '/api/v1/farms');
}

export function recordsRequest(farmId: string, since: number): IHttpRequestOptions {
	return buildRequest('GET', '/api/v1/sync/records', { farm_id: farmId, since });
}

export interface EntryInput {
	id: string;
	farmId: string;
	country: string;
	parcelReference: string;
	entryType: string;
	title: string;
	eventAt: string;
	quantity?: number;
	unit: string;
	registrationNumber: string;
	safetyDays?: number;
}

function isoDate(value: string): string {
	const date = new Date(value);
	if (!value || Number.isNaN(date.getTime())) throw new AgroGpsInputError('Date must be a valid date or date-time');
	return date.toISOString();
}

function nonNegative(value: number | undefined, label: string): number {
	if (value === undefined) return 0;
	if (!Number.isFinite(value) || value < 0) throw new AgroGpsInputError(`${label} must be zero or a positive number`);
	return value;
}

export function registerEntryRequest(entry: EntryInput, now: Date): IHttpRequestOptions {
	if (!UUID_PATTERN.test(entry.id)) throw new AgroGpsInputError('Operation ID must be a UUID');
	if (!ENTRY_TYPES[entry.entryType]) throw new AgroGpsInputError(`Unsupported operation type: ${entry.entryType}`);
	const eventAt = isoDate(entry.eventAt);
	const body: IDataObject = {
		country: entry.country,
		entries: [
			{
				id: entry.id,
				parcel_refcat: requireText(entry.parcelReference, 'Field Reference'),
				entry_type: entry.entryType,
				title: requireText(entry.title, 'Title'),
				event_at: eventAt,
				quantity: nonNegative(entry.quantity, 'Quantity'),
				unit: entry.unit,
				registration_number: entry.registrationNumber,
				safety_days: Math.trunc(nonNegative(entry.safetyDays, 'Safety Days')),
				version: 1,
				client_created_at: now.toISOString(),
			},
		],
	};
	if (entry.farmId) body.farm_id = entry.farmId;
	return buildRequest('POST', '/api/v1/sync/entries', {}, body);
}

export interface FieldInput {
	farmId: string;
	name: string;
	country: string;
	cropCode: string;
	polygon: number[][];
}

export function createFieldsRequest(fields: FieldInput[]): IHttpRequestOptions {
	if (fields.length === 0) throw new AgroGpsInputError('Add at least one field');
	if (fields.length > MAX_FIELDS_PER_IMPORT) {
		throw new AgroGpsInputError(`Send at most ${MAX_FIELDS_PER_IMPORT} fields at a time`);
	}
	const body: IDataObject = {
		fields: fields.map((field) => ({
			name: requireText(field.name, 'Field Name'),
			country: field.country,
			crop_code: field.cropCode,
			polygon: field.polygon,
		})),
	};
	if (fields[0].farmId) body.farm_id = fields[0].farmId;
	return buildRequest('POST', '/api/v1/fields', {}, body);
}

function point(value: unknown): number[] | undefined {
	if (!Array.isArray(value) || value.length < 2) return undefined;
	const [a, b] = value.map(Number);
	return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : undefined;
}

function ringFromGeoJson(geometry: IDataObject): unknown[] {
	if (geometry.type === 'Feature') return ringFromGeoJson((geometry.geometry ?? {}) as IDataObject);
	const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
	if (geometry.type === 'Polygon') return (coordinates[0] as unknown[]) ?? [];
	if (geometry.type === 'MultiPolygon') return ((coordinates[0] as unknown[]) ?? [])[0] as unknown[] ?? [];
	throw new AgroGpsInputError('GeoJSON must be a Polygon, MultiPolygon or a Feature with one of them');
}

function checkLatLng(pair: number[]): number[] {
	const [lat, lng] = pair;
	if (Math.abs(lat) > LATITUDE_LIMIT || Math.abs(lng) > LONGITUDE_LIMIT) {
		throw new AgroGpsInputError('Polygon points must be valid [latitude, longitude] pairs');
	}
	return [lat, lng];
}

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return undefined;
	}
}

export function parsePolygon(raw: unknown): number[][] {
	const value = typeof raw === 'string' ? parseJson(raw) : raw;
	if (value === undefined) {
		throw new AgroGpsInputError('Polygon must be JSON: [[lat, lng], …] or a GeoJSON Polygon');
	}
	let pairs: number[][];
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		pairs = ringFromGeoJson(value as IDataObject)
			.map(point)
			.filter((p): p is number[] => p !== undefined)
			.map(([lng, lat]) => [lat, lng]);
	} else {
		pairs = (Array.isArray(value) ? value : []).map(point).filter((p): p is number[] => p !== undefined);
	}
	const ring = pairs.map(checkLatLng);
	const first = ring[0];
	const last = ring[ring.length - 1];
	const closed = ring.length > 1 && first[0] === last[0] && first[1] === last[1];
	const open = closed ? ring.slice(0, -1) : ring;
	if (open.length < MIN_POLYGON_POINTS) {
		throw new AgroGpsInputError(`Polygon needs at least ${MIN_POLYGON_POINTS} distinct points`);
	}
	return open;
}

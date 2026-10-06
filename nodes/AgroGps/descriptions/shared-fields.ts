import type { INodePropertyOptions } from 'n8n-workflow';
import { COUNTRY_NAMES, ENTRY_TYPES } from '../shared/constants';

export function countryOptions(): INodePropertyOptions[] {
	return Object.entries(COUNTRY_NAMES)
		.map(([value, name]) => ({ name, value }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function entryTypeOptions(): INodePropertyOptions[] {
	return Object.entries(ENTRY_TYPES)
		.map(([value, name]) => ({ name, value }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

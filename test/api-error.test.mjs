import { describe, expect, it } from 'vitest';
import { describeApiError } from '../nodes/AgroGps/shared/api-error';

describe('describeApiError', () => {
	it.each([
		[403, { code: 'AUT_004' }, 'This API key is read-only'],
		[403, { code: 'AUT_005', message: 'no' }, 'An API key cannot do this'],
		[429, { code: 'KEY_430' }, 'Daily API quota exhausted'],
		[404, { code: 'FIT_405' }, 'This country register is not available yet'],
		[429, {}, 'Too many requests'],
		[401, { code: 'AUT_003' }, 'Invalid or missing API key'],
		[403, { code: 'SYN_405' }, 'Not allowed on this farm'],
		[404, { code: 'FIT_404' }, 'Not found'],
		[400, {}, 'The request was rejected'],
		[422, {}, 'The request was rejected'],
		[502, {}, 'Agro GPS server error'],
		[302, {}, 'Unexpected response (HTTP 302)'],
	])('maps HTTP %i %j', (status, body, message) => {
		expect(describeApiError(status, body).message).toBe(message);
	});

	it('adds the server message, the code and the retry hint', () => {
		const error = describeApiError(400, { code: 'SYN_400', message: 'farm_id inválido' });
		expect(error).toMatchObject({ httpCode: '400', code: 'SYN_400' });
		expect(error.description).toContain('API message: farm_id inválido');
		expect(describeApiError(429, {}, 30).description).toContain('Retry after 30 seconds');
		expect(describeApiError(500, {}).description).not.toContain('API message');
	});

	it('copes with a non-object body', () => {
		expect(describeApiError(500, 'oops').code).toBeUndefined();
		expect(describeApiError(500, ['a']).message).toBe('Agro GPS server error');
	});
});

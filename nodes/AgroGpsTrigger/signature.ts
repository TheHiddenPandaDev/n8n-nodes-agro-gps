import { createHmac, timingSafeEqual } from 'crypto';

export type SignatureVerdict = 'valid' | 'missing' | 'stale' | 'mismatch';

const SIGNATURE_PREFIX = 'sha256=';

export function sign(secret: string, timestamp: string, body: Buffer): string {
	const mac = createHmac('sha256', secret);
	mac.update(timestamp);
	mac.update('.');
	mac.update(body);
	return SIGNATURE_PREFIX + mac.digest('hex');
}

export function verifySignature(
	secret: string,
	timestamp: string,
	signature: string,
	body: Buffer,
	nowSeconds: number,
	maxAgeSeconds: number,
): SignatureVerdict {
	if (!secret || !timestamp || !signature) return 'missing';
	const sentAt = Number(timestamp);
	if (!Number.isFinite(sentAt)) return 'missing';
	if (maxAgeSeconds > 0 && Math.abs(nowSeconds - sentAt) > maxAgeSeconds) return 'stale';
	const expected = Buffer.from(sign(secret, timestamp, body));
	const received = Buffer.from(signature);
	if (expected.length !== received.length) return 'mismatch';
	return timingSafeEqual(expected, received) ? 'valid' : 'mismatch';
}

export function wantsEvent(selected: string[], event: string): boolean {
	return selected.length === 0 || selected.includes('*') || selected.includes(event);
}

export function rawBodyOf(rawBody: unknown, parsed: unknown): Buffer {
	if (Buffer.isBuffer(rawBody)) return rawBody;
	if (typeof rawBody === 'string') return Buffer.from(rawBody);
	return Buffer.from(JSON.stringify(parsed ?? {}));
}

export function headerValue(value: unknown): string {
	if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
	return typeof value === 'string' ? value : '';
}

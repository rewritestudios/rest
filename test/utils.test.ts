import { describe, expect, it } from 'bun:test';
import {
	backoff,
	createURL,
	isRetryableStatus,
	isTimeoutError,
	RATE_LIMIT_STATUS,
} from '../src/utils';

describe('utils', () => {
	it('creates URL without query string', () => {
		expect(createURL('/messages')).toBe(
			'https://api.rewritetoday.com/v1/messages',
		);
	});

	it('creates URL with query string from object', () => {
		expect(createURL('/messages', { page: '1', limit: '10' })).toBe(
			'https://api.rewritetoday.com/v1/messages?page=1&limit=10',
		);
	});

	it('accepts custom base URL', () => {
		expect(createURL('/health', undefined, 'https://localhost:3000')).toBe(
			'https://localhost:3000/v1/health',
		);
	});

	it('identifies retryable HTTP statuses', () => {
		expect(isRetryableStatus(500)).toBe(true);
		expect(isRetryableStatus(RATE_LIMIT_STATUS)).toBe(true);
		expect(isRetryableStatus(418)).toBe(false);
	});

	it('detects timeout errors by name', () => {
		expect(isTimeoutError({ name: 'TimeoutError' })).toBe(true);
		expect(isTimeoutError({ name: 'TypeError' })).toBe(false);
		expect(isTimeoutError(null)).toBe(false);
	});

	it('returns bounded jittered backoff value', () => {
		const attempt = 3;
		const base = Math.min(10_000, 300 * 2 ** attempt);
		const delay = backoff(attempt);

		expect(delay).toBeGreaterThanOrEqual(base);
		expect(delay).toBeLessThanOrEqual(Math.floor(base * 1.3));
	});
});

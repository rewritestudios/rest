import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	mock,
} from 'bun:test';
import { REST } from '../src/client';
import { HTTPError, RateLimitError, RewriteError } from '../src/errors';

const createJSONResponse = (
	status: number,
	payload: unknown,
	headers?: HeadersInit,
) =>
	new Response(JSON.stringify(payload), {
		status,
		headers: {
			'Content-Type': 'application/json',
			...(headers ?? {}),
		},
	});

const createResponse = (status: number, headers?: HeadersInit) =>
	new Response(null, { status, headers });

describe('REST', () => {
	let originalFetch: typeof fetch;

	beforeAll(() => {
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	afterAll(() => {
		globalThis.fetch = originalFetch;
	});

	it('runs GET request and returns data payload', async () => {
		const fetchMock = mock(async () =>
			createJSONResponse(200, { data: { id: 'msg_1' } }),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const client = new REST('api-key');
		const data = await client.get<{ id: string }>('/messages', {
			query: { page: '1' },
		});

		expect(data).toEqual({ id: 'msg_1' });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.rewritetoday.com/v1/messages?page=1',
			expect.objectContaining({
				method: 'GET',
				body: null,
				headers: expect.objectContaining({
					Authorization: 'Bearer api-key',
					'Content-Type': 'application/json',
				}),
			}),
		);
	});

	it('runs POST request with JSON body', async () => {
		const fetchMock = mock(async () =>
			createJSONResponse(200, { data: { success: true } }),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const client = new REST('api-key');
		const payload = { to: '+5511999999999', message: 'oi' };
		await client.post('/messages', payload);

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.rewritetoday.com/v1/messages',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify(payload),
			}),
		);
	});

	it('updates authorization through setAuth', async () => {
		const fetchMock = mock(async () =>
			createJSONResponse(200, { data: { ok: true } }),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const client = new REST('old-token');
		const returned = client.setAuth('new-token');
		await client.get('/health');

		expect(returned).toBe(client);
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.rewritetoday.com/v1/health',
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: 'Bearer new-token',
				}),
			}),
		);
	});

	it('throws RewriteError for non-retryable status', async () => {
		const fetchMock = mock(async () =>
			createJSONResponse(400, {
				message: 'Invalid payload',
				code: 'INVALID_PAYLOAD',
				error: { detailed: { field: 'to' } },
			}),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const client = new REST('api-key');

		expect(client.post('/messages', {})).rejects.toBeInstanceOf(
			RewriteError,
		);

		try {
			await client.post('/messages', {});
		} catch (error) {
			expect(error).toBeInstanceOf(RewriteError);
			expect((error as RewriteError).code).toBe('INVALID_PAYLOAD');
			expect((error as RewriteError).detailed).toEqual({ field: 'to' });
		}
	});

	it('retries retryable status and succeeds', async () => {
		const responses = [
			createResponse(500),
			createJSONResponse(200, { data: { ok: true } }),
		];
		const onRetry = mock(async () => undefined);
		const fetchMock = mock(async () => {
			const response = responses.shift();
			if (!response) throw new Error('No mocked response left');

			return response;
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const client = new REST({
			auth: 'api-key',
			retry: {
				max: 2,
				delay: () => 0,
				onRetry,
			},
		});
		const data = await client.get<{ ok: boolean }>('/messages');

		expect(data).toEqual({ ok: true });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(onRetry).toHaveBeenCalledTimes(1);
		expect(onRetry).toHaveBeenCalledWith(
			expect.objectContaining({
				attempt: 0,
				method: 'GET',
				route: '/messages',
			}),
		);
	});

	it('throws HTTPError when retry attempts are exhausted', async () => {
		const fetchMock = mock(async () => createResponse(503));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const client = new REST({
			auth: 'api-key',
			retry: { max: 0 },
		});

		await expect(client.get('/unavailable')).rejects.toBeInstanceOf(HTTPError);
	});

	it('throws RateLimitError with parsed context when max retries is reached', async () => {
		const fetchMock = mock(async () =>
			createResponse(429, {
				'X-RateLimit-Limit': '100',
				'X-RateLimit-Global': 'false',
				'X-RateLimit-Retry-After': '1500',
			}),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const client = new REST({
			auth: 'api-key',
			retry: { max: 0 },
		});

		try {
			await client.get('/messages');
		} catch (error) {
			expect(error).toBeInstanceOf(RateLimitError);
			const rateLimitError = error as RateLimitError;
			expect(rateLimitError.limit).toBe(100);
			expect(rateLimitError.global).toBe(false);
			expect(rateLimitError.retryAfter).toBe(1500);
			return;
		}

		throw new Error('Expected RateLimitError to be thrown');
	});

	it('calls onRateLimit callback and retries when receiving status 429', async () => {
		const responses = [
			createResponse(429, {
				'X-RateLimit-Limit': '25',
				'X-RateLimit-Global': 'true',
				'X-RateLimit-Retry-After': '0',
			}),
			createJSONResponse(200, { data: { ok: true } }),
		];
		const onRateLimit = mock(async () => undefined);
		const fetchMock = mock(async () => {
			const response = responses.shift();
			if (!response) throw new Error('No mocked response left');

			return response;
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const client = new REST({
			auth: 'api-key',
			onRateLimit,
			retry: {
				max: 1,
				delay: () => 0,
			},
		});

		const data = await client.get<{ ok: boolean }>('/messages');

		expect(data).toEqual({ ok: true });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(onRateLimit).toHaveBeenCalledTimes(1);
		expect(onRateLimit).toHaveBeenCalledWith(
			expect.objectContaining({
				limit: 25,
				isGlobal: true,
				retryAfter: 0,
			}),
		);
	});
});

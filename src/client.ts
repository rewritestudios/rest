import { HTTPError, RateLimitError, RewriteError } from './errors';
import type {
	FetchOptions,
	RateLimitContext,
	RESTOptions,
	RequestOptions,
	RetryOptions,
	RewriteHandleErrorOptions,
} from './types';
import {
	backoff,
	createURL,
	FIVE_SECONDS_IN_MS,
	isRetryableStatus,
	RATE_LIMIT_STATUS,
	sleep,
} from './utils';

/**
 * Main class to interact with the Rewrite API.
 */
export class REST {
	/**
	 * The options for the REST client.
	 */
	public options: RESTOptions;

	/**
	 * The headers to send with each request.
	 */
	public headers = { 'Content-Type': 'application/json' } as Record<
		string,
		string
	>;

	constructor(options: RESTOptions | string) {
		this.options = typeof options === 'string' ? { auth: options } : options;

		this.headers = {
			'Content-Type': 'application/json',
			...this.options.headers,
			Authorization: `Bearer ${this.options.auth}`,
		};
	}

	/**
	 * Sets the API key for the REST client.
	 *
	 * @param {string} authorization - The API key to use.
	 */
	setAuth(authorization: string) {
		this.options.auth = authorization;
		this.headers.Authorization = `Bearer ${authorization}`;

		return this;
	}

	/**
	 * Runs a GET request from the API.
	 */
	public get<R>(route: string, options?: RequestOptions) {
		return this.fetch<R>(route, { ...options, method: 'GET' });
	}

	/**
	 * Runs a POST request from the API.
	 */
	public post<R>(route: string, data?: unknown, options?: RequestOptions) {
		return this.fetch<R>(route, { data, ...options, method: 'POST' });
	}

	/**
	 * Runs a DELETE request from the API.
	 */
	public delete<R>(route: string, options?: RequestOptions) {
		return this.fetch<R>(route, { ...options, method: 'DELETE' });
	}

	/**
	 * Runs a PUT request from the API.
	 */
	public put<R>(route: string, options?: RequestOptions) {
		return this.fetch<R>(route, { ...options, method: 'PUT' });
	}

	/**
	 * Runs a PATCH request from the API.
	 */
	public patch<R>(route: string, data?: unknown, options?: RequestOptions) {
		return this.fetch<R>(route, { data, ...options, method: 'PATCH' });
	}

	private async fetch<R>(route: string, options: FetchOptions, attempt = 0) {
		const response = await this.prefetch(route, options);

		if (!response.ok)
			return this.handleError<R>({
				route,
				attempt,
				options,
				response,
				method: options.method,
			});

		const { data } = await response.json();

		return data as R;
	}

	private async handleError<R>({
		route,
		method,
		options,
		attempt,
		response,
	}: RewriteHandleErrorOptions): Promise<R> {
		if (!isRetryableStatus(response.status)) {
			const { code, error, message } = await response.json();

			throw new RewriteError(message, code, error.detailed);
		}

		const { onRateLimit, retry } = this.options;
		const rateLimitContext =
			response.status === RATE_LIMIT_STATUS
				? this.parseRateLimitContext(response)
				: null;

		if (attempt >= (retry?.max ?? 3))
			throw this.buildRetryExceededError(response, method, rateLimitContext);

		if (rateLimitContext && onRateLimit) await onRateLimit(rateLimitContext);

		if (retry?.onRetry)
			await retry.onRetry({ route, attempt, options, response, method });

		const delay = this.resolveRetryDelay(attempt, retry, rateLimitContext);

		await sleep(delay);

		return this.fetch<R>(route, options, attempt + 1);
	}

	/**
	 * Builds the retry exhaustion error for retryable responses.
	 */
	private buildRetryExceededError(
		response: Response,
		method: string,
		rateLimitContext: RateLimitContext | null,
	) {
		if (rateLimitContext)
			return new RateLimitError(
				'Rate limit has not been reset yet',
				response.url,
				method,
				rateLimitContext,
			);

		return new HTTPError(
			'Max retries reached',
			response.status,
			response.url,
			method,
		);
	}

	/**
	 * Resolves delay before the next retry attempt.
	 */
	private resolveRetryDelay(
		attempt: number,
		retry: RetryOptions | undefined,
		rateLimitContext: RateLimitContext | null,
	) {
		const retryAfterDelay = rateLimitContext?.retryAfter ?? 0;

		if (retryAfterDelay > 0) return retryAfterDelay;

		return (retry?.delay ?? backoff)(attempt);
	}

	/**
	 * Parses rate-limit headers from a `429` response.
	 */
	private parseRateLimitContext(response: Response): RateLimitContext {
		const { headers } = response;

		const xRateLimitRetryAfter = this.parseNumberHeader(
			headers,
			'X-RateLimit-Retry-After',
		);

		const retryAfter =
			xRateLimitRetryAfter > 0
				? xRateLimitRetryAfter
				: this.parseRetryAfterHeader(headers.get('Retry-After'));

		return {
			retryAfter,
			limit: Number(headers.get('X-RateLimit-Limit')),
			isGlobal: this.parseBooleanHeader(headers, 'X-RateLimit-Global'),
		};
	}

	/**
	 * Parses a numeric header and safely falls back to `0`.
	 */
	private parseNumberHeader(headers: Headers, key: string) {
		const value = headers.get(key);
		if (!value) return 0;

		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}

	/**
	 * Parses a boolean-like header.
	 */
	private parseBooleanHeader(headers: Headers, key: string) {
		return headers.get(key)?.toLowerCase() === 'true';
	}

	/**
	 * Parses the `Retry-After` header and returns delay in milliseconds.
	 */
	private parseRetryAfterHeader(header: string | null) {
		if (!header) return 0;

		const seconds = Number(header);

		if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds * 1000));

		const date = Date.parse(header);

		return Number.isNaN(date) ? 0 : Math.max(0, date - Date.now());
	}

	private prefetch(route: string, options: FetchOptions) {
		const timeout =
			options.timeout ?? this.options.timeout ?? FIVE_SECONDS_IN_MS;
		const url = createURL(route, options.query, this.options.baseURL);

		return fetch(url, {
			method: options.method,
			signal: AbortSignal.timeout(timeout),
			headers: { ...this.headers, ...options.headers },
			body: 'data' in options ? JSON.stringify(options.data) : null,
		});
	}
}

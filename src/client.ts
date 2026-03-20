import { HTTPError, RateLimitError } from './errors';
import type {
	FetchOptions,
	RateLimitContext,
	RESTOptions,
	RequestOptions,
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
import { version } from './version';

const DEFAULT_RETRY_MAX = 3;

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
	public headers: Record<string, string>;

	constructor(options: RESTOptions | string) {
		this.options =
			typeof options === 'string' ? { auth: options } : { ...options };
		this.headers = {
			'Content-Type': 'application/json',
			'User-Agent': `@rewritetoday/rest (${version})`,
			...this.options.headers,
		};

		this.setAuth(this.options.auth);
	}

	/**
	 * Sets the API key for the REST client.
	 *
	 * @param {string} authorization - The API key to use.
	 */
	setAuth(authorization: string) {
		if (typeof authorization !== 'string' || !authorization.startsWith('rw_'))
			throw new Error('Unknown or invalid API key.');

		this.options.auth = authorization;
		this.headers.Authorization = `Bearer ${authorization}`;

		return this;
	}

	/**
	 * Runs a `GET` request from the API.
	 */
	public get<R>(route: string, options?: RequestOptions) {
		return this.request<R>(route, { ...options, method: 'GET' });
	}

	/**
	 * Runs a `POST` request from the API.
	 */
	public post<R>(route: string, data?: unknown, options?: RequestOptions) {
		return this.request<R>(route, { data, ...options, method: 'POST' });
	}

	/**
	 * Runs a `DELETE` request from the API.
	 */
	public delete<R>(route: string, options?: RequestOptions) {
		return this.request<R>(route, { ...options, method: 'DELETE' });
	}

	/**
	 * Runs a `PUT` request from the API.
	 */
	public put<R>(route: string, data?: unknown, options?: RequestOptions) {
		return this.request<R>(route, { data, ...options, method: 'PUT' });
	}

	/**
	 * Runs a `PATCH` request from the API.
	 */
	public patch<R>(route: string, data?: unknown, options?: RequestOptions) {
		return this.request<R>(route, { data, ...options, method: 'PATCH' });
	}

	private async request<R>(route: string, options: FetchOptions, attempt = 0) {
		const timeout =
			options.timeout ?? this.options.timeout ?? FIVE_SECONDS_IN_MS;

		const response = await fetch(
			createURL(route, options.query, this.options.baseURL),
			{
				method: options.method,
				headers: { ...this.headers, ...options.headers },
				signal: AbortSignal.timeout(timeout),
				body: 'data' in options ? JSON.stringify(options.data) : null,
			},
		);

		if (!response.ok)
			return this.handleError<R>({
				route,
				attempt,
				options,
				response,
				method: options.method,
			});

		return (await response.json()) as R;
	}

	private async handleError<R>({
		route,
		method,
		options,
		attempt,
		response,
	}: RewriteHandleErrorOptions): Promise<R> {
		if (!isRetryableStatus(response.status)) return await response.json();

		const { onRateLimit, retry } = this.options;

		const rateLimitContext =
			response.status === RATE_LIMIT_STATUS
				? this.parseRateLimitContext(response)
				: null;

		if (attempt >= (retry?.max ?? DEFAULT_RETRY_MAX))
			throw this.buildRetryExceededError(response, method, rateLimitContext);

		if (rateLimitContext) await onRateLimit?.(rateLimitContext);
		await retry?.onRetry?.({ route, attempt, options, response, method });

		await sleep(
			rateLimitContext && rateLimitContext.retryAfter > 0
				? rateLimitContext.retryAfter
				: (retry?.delay ?? backoff)(attempt),
		);

		return this.request<R>(route, options, attempt + 1);
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
	 * Parses rate-limit headers from a `429` response.
	 */
	private parseRateLimitContext(response: Response): RateLimitContext {
		const { headers } = response;

		const xRateLimitRetryAfter = this.readNumberHeader(
			headers,
			'X-RateLimit-Retry-After',
		);

		const retryAfter =
			xRateLimitRetryAfter > 0
				? xRateLimitRetryAfter
				: this.parseRetryAfterHeader(headers.get('X-RateLimit-Retry-After'));

		return {
			retryAfter,
			limit: this.readNumberHeader(headers, 'X-RateLimit-Limit'),
			isGlobal: headers.get('X-RateLimit-Global')?.toLowerCase() === 'true',
		};
	}

	/**
	 * Parses a numeric header and safely falls back to `0`.
	 */
	private readNumberHeader(headers: Headers, key: string) {
		const value = headers.get(key);
		if (!value) return 0;

		const parsed = Number(value);

		return Number.isFinite(parsed) ? parsed : 0;
	}

	/**
	 * Parses the `X-RateLimit-Retry-After` header and returns delay in milliseconds.
	 */
	private parseRetryAfterHeader(header: string | null) {
		if (!header) return 0;

		const seconds = Number(header);

		if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds * 1000));

		const date = Date.parse(header);

		return Number.isNaN(date) ? 0 : Math.max(0, date - Date.now());
	}
}

import { HTTPError } from './errors';
import type {
	FetchOptions,
	RESTOptions,
	RewriteHandleErrorOptions,
} from './types';
import {
	backoff,
	createURL,
	FIVE_SECONDS_IN_MS,
	isRetryableStatus,
	sleep,
} from './utils';

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
	public get<R>(route: string, options?: FetchOptions) {
		return this.fetch<R>(route, { ...options, method: 'GET' });
	}

	/**
	 * Runs a POST request from the API.
	 */
	public post<R>(route: string, data?: unknown, options?: FetchOptions) {
		return this.fetch<R>(route, { data, ...options, method: 'POST' });
	}

	/**
	 * Runs a DELETE request from the API.
	 */
	public delete<R>(route: string, options?: FetchOptions) {
		return this.fetch<R>(route, { ...options, method: 'DELETE' });
	}

	/**
	 * Runs a PUT request from the API.
	 */
	public put<R>(route: string, options?: FetchOptions) {
		return this.fetch<R>(route, { ...options, method: 'PUT' });
	}

	/**
	 * Runs a PATCH request from the API.
	 */
	public patch<R>(route: string, data?: unknown, options?: FetchOptions) {
		return this.fetch<R>(route, { data, ...options, method: 'PATCH' });
	}

	private async fetch<R>(route: string, options: FetchOptions, attempt = 0) {
		const response = await this.createRequest(route, options);

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
			const { error } = await response.json();

			throw new HTTPError(error, response.status, response.url, method);
		}

		const { retry } = this.options;

		if (attempt >= (retry?.max ?? 3))
			throw new HTTPError(
				'Max retries reached',
				response.status,
				response.url,
				method,
			);
		if (retry?.onRetry)
			await retry.onRetry({ route, attempt, options, response, method });

		const delay = (retry?.delay ?? backoff)(attempt);

		await sleep(delay);

		return this.fetch<R>(route, options, attempt + 1);
	}

	private createRequest(route: string, options: FetchOptions) {
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

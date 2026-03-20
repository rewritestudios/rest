/**
 * Options to use in the REST class.
 */
export interface RESTOptions {
	/**
	 * Base URL to use in each request to the API.
	 */
	baseURL?: string;
	/**
	 * Authorization token (API key) for the API.
	 */
	auth: string;
	/**
	 * Timeout for requests in milliseconds (Default `5000`).
	 */
	timeout?: number;
	/**
	 * Headers to send with each request.
	 */
	headers?: Record<string, string>;
	/**
	 * Options to use when retrying failed requests.
	 */
	retry?: RetryOptions;
	/**
	 * Callback executed when the API returns a rate limit response (`429`).
	 */
	onRateLimit?(context: RateLimitContext): unknown;
}

/**
 * Context passed to the `onRateLimit` callback.
 */
export interface RateLimitContext {
	/**
	 * Total requests available for the current rate limit window.
	 */
	limit: number;
	/**
	 * Whether this limit was applied globally by the API.
	 */
	isGlobal: boolean;
	/**
	 * Time to wait in milliseconds before retrying.
	 */
	retryAfter: number;
}

/**
 * Options used to retry a request that failed.
 */
export interface RetryOptions {
	/**
	 * Maximum number of retries to attempt.
	 */
	max?: number;
	/**
	 * Delay between retries in milliseconds.
	 */
	delay?(attempt: number): number;
	/**
	 * Callback to execute before each retry.
	 */
	onRetry?(options: RewriteHandleErrorOptions): unknown;
}

/**
 * Options to use when sending a request to the API.
 */
export interface FetchOptions extends Pick<RESTOptions, 'headers' | 'timeout'> {
	/**
	 * Optional data to send in the request body (Stringified internally).
	 */
	data?: unknown;
	/**
	 * Method to use in the request.
	 */
	method: HTTPMethodLike;
	/**
	 * Query string parameters to append to the called endpoint.
	 */
	query?:
		| string
		| Record<string, string>
		| URLSearchParams
		| [string, string][];
}

/**
 * Public request options for helpers like `get`, `post` and `delete`.
 */
export type RequestOptions = Omit<FetchOptions, 'data' | 'method'>;

/**
 * Any HTTP method.
 */
export type HTTPMethodLike =
	| 'GET'
	| 'PUT'
	| 'POST'
	| 'HEAD'
	| 'PATCH'
	| 'DELETE'
	| (string & {});

/**
 * Options used when handling an error.
 *
 * @internal
 */
export interface RewriteHandleErrorOptions {
	method: string;
	route: string;
	attempt: number;
	response: Response;
	options: FetchOptions;
}

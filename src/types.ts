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
}

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

export interface RewriteHandleErrorOptions {
	method: string;
	route: string;
	attempt: number;
	response: Response;
	options: FetchOptions;
}

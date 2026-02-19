import type { RateLimitContext } from './types';

/**
 * Main class to represent a HTTP error.
 */
export class HTTPError extends Error {
	constructor(
		public message: string,
		/**
		 * The status code of the response.
		 */
		public status: number,
		/**
		 * The URL of the response.
		 */
		public url: string,
		/**
		 * The method used in the request.
		 */
		public method: string,
	) {
		super(message);

		this.name = `HTTPError(${status})`;
	}
}

/**
 * Error thrown when the API rate limit has not been reset yet.
 */
export class RateLimitError extends HTTPError {
	/**
	 * Total requests available for the current rate limit window.
	 */
	public limit: number;
	/**
	 * Whether this limit was applied globally by the API.
	 */
	public global: boolean;
	/**
	 * Time to wait in milliseconds before retrying.
	 */
	public retryAfter: number;

	constructor(
		message: string,
		url: string,
		method: string,
		context: RateLimitContext,
	) {
		super(message, 429, url, method);

		this.limit = context.limit;
		this.global = context.isGlobal;
		this.retryAfter = context.retryAfter;

		this.name = 'RateLimitError';
	}
}

/**
 * Error thrown when the API returns a business-level error payload.
 */
export class RewriteError extends Error {
	/**
	 * @param {string} message - User-facing message from the API.
	 * @param {string} code - API error code.
	 * @param {object} detailed - Detailed API metadata for the error.
	 */
	public constructor(
		public message: string,
		public code: string,
		public detailed: object,
	) {
		super(message);
	}
}

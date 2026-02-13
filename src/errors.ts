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

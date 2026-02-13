export class HTTPError extends Error {
	constructor(message: string, public status: number, public url: string, public method: string) {
		super(message);
		
		this.name = `HTTPError(${status})`;
	}
}

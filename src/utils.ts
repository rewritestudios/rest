import type { FetchOptions } from './types';

export const createURL = (
	route: string,
	query?: FetchOptions['query'],
	baseURL = 'https://api.userewrite.me',
) => {
	const url = `${baseURL}/v1${route}`;

	return query ? `${url}?${new URLSearchParams(query)}` : url;
};

export const FIVE_SECONDS_IN_MS = 5000;

export const isTimeoutError = (err: unknown) =>
	(err as { name?: string })?.name === 'TimeoutError';

const RETRYABLE_STATUS = [408, 425, 429, 500, 502, 503, 504];

export const isRetryableStatus = (status: number) =>
	RETRYABLE_STATUS.includes(status);

const BASE_DELAY_MS = 300;
const MAX_DELAY_MS = 10_000;

/**
 * Function to calculate the delay with Jitter for retrying a request.
 */
export const backoff = (attempt: number) => {
	const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
	const jitter = Math.random() * exp * 0.3;

	return Math.floor(exp + jitter);
};

export const sleep = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

import type { FetchOptions } from './types';
import { API_VERSION } from './version';

const DEFAULT_BASE_URL = 'https://api.rewritetoday.com';
const API_PATH = `/v${API_VERSION}`;

const normalizeBaseURL = (baseURL: string) => {
	let normalized = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;

	if (normalized.endsWith(API_PATH))
		normalized = normalized.slice(0, -API_PATH.length);

	return normalized;
};

export const createURL = (
	route: string,
	query?: FetchOptions['query'],
	baseURL = DEFAULT_BASE_URL,
) => {
	const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
	const url = new URL(
		`${normalizeBaseURL(baseURL)}${API_PATH}${normalizedRoute}`,
	);

	if (query) url.search = new URLSearchParams(query).toString();

	return url.toString();
};

export const FIVE_SECONDS_IN_MS = 5000;

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

export const RATE_LIMIT_STATUS = 429;

<div align="center">

# Rewrite REST

A **REST** client for the **Rewrite API** — fast, secure, and reliable.<br/>
[@rewritejs/rest](https://www.npmjs.com/package/@rewritejs/rest) is a lightweight, fully typed HTTP client designed to interact seamlessly with the **Rewrite API**.

Built for Node.js, Bun, and modern runtimes, it includes smart retries, timeout control, consistent error handling, and a clean developer experience for sending and managing SMS at scale.

## Installing

You can use your favorite package manager to install our package

</div>

```bash
npm install @rewritejs/rest
# Or
yarn add @rewritejs/rest
# Or
bun add @rewritejs/rest
```

<div align="center">

## Using the REST Client

You can use any route, any method, and any payload to interact with the Rewrite API.

</div>

```ts
import { REST } from '@rewritejs/rest';

const client = new REST(process.env.REWRITE_API_KEY);

const data = await client.post('/messages', {
	data: {
		to: '+1234567890',
		message: 'Hey, using REST here',
	},
});

console.log({ data });
```

<div align="center">

### Retry & Backoff (Delay)

By default, our **REST** client try 3 times with a Jitter delay between each attempt.<br/> But you can customize easily in the `retry` option.

</div>

```ts
const client = new REST({
	auth: process.env.REWRITE_API_KEY,
	retry: {
		max: 5,
		delay(attempt) {
			return attempt * 0.5;
		},
	},
	timeout: 3_000,
});
```

<div align="center">

You can also use callback function to execute **before** each request:

</div>

```ts
const client = new REST({
	auth: process.env.REWRITE_API_KEY,
	retry: {
		max: 7,
		async onRetry({ response }) {
			const { error } = await response.json();
			
			console.error({ error });
		},
	},
});
```

<div align="center">

## Handling Errors

Our **REST Client** handles errors gracefully and provides a consistent error handling experience.

</div>

```ts
import { REST, HTTPError } from '@rewritejs/rest';

const client = new REST(process.env.REWRITE_API_KEY);

try {
	const data = await client.get('/projects/invalid', {
		query: {
			...
		},
	});
} catch (error) {
	if (error instanceof HTTPError) {
		console.error({ error });
	}
}
```

<div align="center">

You can view our documentation going [here](https://docs.userewrite.me/en/api-reference/errors). Thanks for using our REST Client!

</div>
<div align="center">

# Rewrite REST

A **REST** client for the **Rewrite API** — fast, secure, and reliable.<br/>
[@rewritetoday/rest](https://www.npmjs.com/package/@rewritetoday/rest) is a lightweight, fully typed HTTP client designed to interact seamlessly with the **Rewrite API**.

Built for Node.js, Bun, and modern runtimes, it includes smart retries, timeout control, consistent error handling, and a clean developer experience for sending and managing SMS at scale.

## Installing

You can use your favorite package manager to install our package

</div>

```bash
npm install @rewritetoday/rest
# Or
yarn add @rewritetoday/rest
# Or
bun add @rewritetoday/rest
```

<div align="center">

## Using the REST Client

You can use any route, any method, and any payload to interact with the Rewrite API.

</div>

```ts
import { REST } from '@rewritetoday/rest';

const client = new REST(process.env.REWRITE_API_KEY);

const { data, error } = await client.post('/messages', {
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
	timeout: 3_000,
	auth: process.env.REWRITE_API_KEY,
	retry: {
		max: 5,
		delay(attempt) {
			return attempt * 0.5;
		},
	},
});
```

<div align="center">

You can also use callback function to execute **before** each retry:

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
import { REST, HTTPError } from '@rewritetoday/rest';

const client = new REST(process.env.REWRITE_API_KEY);

const { data, error } = await client.get('/message/1234567890');

if (error) {
	console.error({ error });
}

console.log({ data });
```

<div align="center">

You can view our documentation going [here](https://docs.rewritetoday.com/en/api-reference/errors). Thanks for using our REST Client!

</div>
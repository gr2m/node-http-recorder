# `@gr2m/http-recorder`

> Library agnostic in-process recording of http(s) requests and responses

[![Test](https://github.com/gr2m/node-http-recorder/actions/workflows/test.yml/badge.svg)](https://github.com/gr2m/node-http-recorder/actions/workflows/test.yml)

## Features

- unopiniated, minimal library, as low-level as possible
- to record http(s) requests and responses within the same process, without starting a server or proxying

## Goals & trade-offs

I created `@gr2m/http-recorder` as a utility library that can be used as a building stone for more opiniated libraries. I'm one of the maintainers of [nock](https://github.com/nock/nock/) and hope to use this library to replace what `nock` is currently doing with much more code.

`@gr2m/http-recorder` plays well with [Mitm.js](https://github.com/moll/node-mitm) (or its [esm version](https://github.com/gr2m/mitm-esm)), which is another lowe-level library but focused on mocking http(s) and net requests.

Note that the requests & responses you receive from the `"record"` event is as-is. If the request or response was encoded then it's up to you to decode it if you need to.

## Install

```
npm install @gr2m/http-recorder
```

## Usage

```js
import http from "node:http";
import httpRecorder from "@gr2m/http-recorder";

httpRecorder.start();
httpRecorder.addListener(
  "record",
  ({ request, response, requestBody, responseBody }) => {
    const { method, protocol, host, path } = request;
    const requestHeaders = request.getHeaders();

    console.log(`> %s %s//%s%s`, method, protocol, host, path);
    console.log(`> %j`, requestHeaders);
    console.log(Buffer.concat(requestBody).toString());

    const { statusCode, statusMessage, headers: responseHeaders } = response;
    console.log(`\n< %s %s`, statusCode, statusMessage);
    console.log(`< %j`, responseHeaders);
    console.log(Buffer.concat(responseBody).toString());
  }
);

const request = http.request("http://httpbin.org/post", { method: "post" });
request.write("data");
request.end();

// > POST http://httpbin.org/post
// > {"host":"httpbin.org"}
// data
//
// < 200 OK
// < {"content-type":"application/json",...}
// {
//   "args": {},
//   "data": "data",
//   ...
// }
```

See more [examples](examples)

## API

`httpRecorder` is a singleton API.

### `httpRecorder.start()`

Hooks into the request life cycle and emits `record` events for each request sent through the `http` or `https` modules.

### `httpRecorder.stop()`

Removes the hooks. No `record` events will be emitted.

### `httpRecorder.addListener("record", listener)`

Subscribe to a `record` event. The `listener` callback is called with an options object

- `options.request`: an [`http.ClientRequest` instance](https://nodejs.org/api/http.html#class-httpclientrequest)
- `options.response`: an [`http.IncomingMessage` instance](https://nodejs.org/api/http.html#class-httpincomingmessage)
- `options.requestBody`: An array of Buffer chunks representing the request body
- `options.responseBody`: An array of Buffer chunks representing the response body

### `httpRecorder.removeListener("record", listener)`

Remove a `record` event listener.

### `httpRecorder.removeAllListeners()`

Removes all `record` event listeners.

## How it works

Once started, `httpRecorder` hooks itself into [the `http.ClientRequest.prototype.onSocket` method](https://github.com/nodejs/node/blob/cf6996458b82ec0bdf97209bce380e1483c349fb/lib/_http_client.js#L778-L782) which is conveniently called synchronously in [the `http.ClientRequest` constructor](https://nodejs.org/api/http.html#class-httpclientrequest).

When a request is intercepted, we

1. hook into [the `request.write` method](https://github.com/nodejs/node/blob/cf6996458b82ec0bdf97209bce380e1483c349fb/lib/_http_outgoing.js#L701-L711) and [the `request.end` method](https://github.com/nodejs/node/blob/cf6996458b82ec0bdf97209bce380e1483c349fb/lib/_http_outgoing.js#L833-L906) in order to clone the request body
2. subscribe to [the `response` event](https://nodejs.org/api/http.html#event-response)
3. hook into the `response.emit` method in order to clone the response body without consuming it

and then emit a `record` event with the `request`, `response`, `requestBody` and `responseBody` options.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## Credit

The inspiration for hooking into `http.ClientRequest.prototype.onSocket` method comes from [Mitm.js](https://github.com/moll/node-mitm/#readme) - an http mocking library for TCP connections and http(s) requests.

## License

[MIT](LICENSE)

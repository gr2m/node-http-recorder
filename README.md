# `@gr2m/http-recorder`

> Library agnostic in-process recording of http(s) requests and responses

[![Test](https://github.com/gr2m/http-recorder/actions/workflows/test.yml/badge.svg)](https://github.com/gr2m/http-recorder/actions/workflows/test.yml)

## Install

```
npm install @gr2m/http-recorder
```

## Usage

```js
import http from "node:http";
import HttpRecorder from "@gr2m/http-recorder";

HttpRecorder.enable();
HttpRecorder.on(
  "record",
  async ({ request, response, requestBody, responseBody }) => {
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

## API

`HttpRecorder` is a singleton API.

### `HttpRecorder.enable()`

Hooks into the request life cycle and emits `record` events for each request sent through the `http` or `https` modules.

### `HttpRecorder.disable()`

Removes the hooks. No `record` events will be emitted.

### `HttpRecorder.on("record", listener)`

Subscribe to a `record` event. The `listener` callback is called with an options object

- `options.request`: an [`http.ClientRequest` instance](https://nodejs.org/api/http.html#class-httpclientrequest)
- `options.response`: an [`http.IncomingMessage` instance](https://nodejs.org/api/http.html#class-httpincomingmessage)
- `options.requestBody`: An array of Buffer chunks representing the request body
- `options.responseBody`: An array of Buffer chunks representing the response body

### `HttpRecorder.off("record", listener)`

Remove a `record` event listener.

### `HttpRecorder.removeAllListeners()`

Removes all `record` event listeners.

## How it works

When enabled, `HttpRecorder` hooks itself into [the `http.ClientRequest.prototype.onSocket` method](https://github.com/nodejs/node/blob/cf6996458b82ec0bdf97209bce380e1483c349fb/lib/_http_client.js#L778-L782) which is conveniently called synchronously in [the `http.ClientRequest` constructor](https://nodejs.org/api/http.html#class-httpclientrequest).

When a request is intercepted, we hook into [the `request.write` method](https://github.com/nodejs/node/blob/cf6996458b82ec0bdf97209bce380e1483c349fb/lib/_http_outgoing.js#L701-L711) in order to clone the request body, subscribe to [the `response` event](https://nodejs.org/api/http.html#event-response), read out the response body, and then emit a `record` event with the `request`, `response`, `requestBody` and `responseBody` options.

## Contributing

See [CONTRIBUTING.md](CONTRIBTING.md)

## Credit

The inspiration for hooking into `http.ClientRequest.prototype.onSocket` method comes from [Mitm.js](https://github.com/moll/node-mitm/#readme) - an http mocking library for TCP connections and http(s) requests.

## License

[MIT](LICENSE)

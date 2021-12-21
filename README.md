# `@gr2m/http-recorder`

> Library agnostic in-process recording of http(s) requests and responses

# 🚧 Work In Progress - See [#1](https://github.com/gr2m/http-recorder/pull/1)

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

## Contributing

See [CONTRIBUTING.md](CONTRIBTING.md)

## License

[MIT](LICENSE)

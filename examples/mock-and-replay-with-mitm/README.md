# Mock & replay with `@gr2m/http-recorder` and [`mitm-esm`](https://www.npmjs.com/package/mitm-esm)

This example sends a request to `http://httpbin.org/post` and records the fixtures. When you run the example the second time then it will replay the fixtures instead of sending another request.

[example.js](example.js)

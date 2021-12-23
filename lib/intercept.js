export default function intercept(interceptedRequest, emitter) {
  // read the request body as an array of Buffer chuncks
  // by hooking into the `request.{write,end}` methods.
  const requestBodyChunks = [];
  for (const method of ["write", "end"]) {
    const originalMethod = interceptedRequest[method];
    interceptedRequest[method] = function (chunk, encoding, callback) {
      // chunk argument may be set to the callback function, see
      // https://github.com/nodejs/node/blob/9e1a08057a0cd803d0878ed4b87774b5f84d6f0a/lib/_http_outgoing.js#L834-L841
      if (typeof encoding === "function") {
        callback = encoding;
        encoding = null;
      }
      if (chunk && typeof chunk !== "function") {
        requestBodyChunks.push(Buffer.from(chunk, encoding || "utf8"));
      }

      return originalMethod.call(this, chunk, encoding, callback);
    };
  }

  interceptedRequest.on("response", async (response) => {
    const responseBodyChunks = [];

    // we patch `response.emit` in order to read out the response data
    // without conusuming it. See https://github.com/gr2m/http-recorder/issues/18
    const originalEmit = response.emit;
    response.emit = function (event, ...args) {
      if (event === "data") {
        responseBodyChunks.push(args[0]);
      }
      return originalEmit.call(response, event, ...args);
    };

    response.on("close", () => {
      // emit the `request` event with the request and response body
      emitter.emit("record", {
        request: interceptedRequest,
        requestBody: requestBodyChunks,
        response,
        responseBody: responseBodyChunks,
      });
    });
  });
}

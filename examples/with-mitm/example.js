import fs from "node:fs";
import http from "node:http";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import Mitm from "mitm-esm";
import recorder from "../../index.js";

setupHttpMocking();
setupHttpRecording();

// send your request here
const request = http.request("http://httpbin.org/deflate", {
  method: "GET",
});
request.on("response", (response) =>
  response.on("data", (data) => console.log(data.toString()))
);
request.end("Hello, world!");

// Setup Mitm.js to intercept requests and replay responses
// from fixtures if there is one matching the request
function setupHttpMocking() {
  const mitm = new Mitm();
  mitm.on("connect", function (socket, options) {
    const { method, pathname } = options;

    if (fs.existsSync(methodAndPathToFixturesPath(method, pathname))) {
      console.log(`[Mitm] fixture found for ${method} ${pathname}`);
    } else {
      console.log(`[Mitm] recording fixture for ${method} ${pathname}`);
      socket.bypass();
    }
  });
  mitm.on("request", function (request, response) {
    const { method, url } = request;

    const fixture = JSON.parse(
      fs.readFileSync(methodAndPathToFixturesPath(method, url), "utf-8")
    );

    response.writeHead(
      fixture.response.statusCode,
      fixture.response.statusMessage,
      fixture.response.headers
    );
    response.end(fixture.response.body, "base64");
  });
}

// Setup the http recorder to record fixtures unless the request
// has been mocked by Mitm.js
function setupHttpRecording() {
  recorder.start();
  recorder.addListener(
    "record",
    async ({ request, response, requestBody, responseBody }) => {
      if (request.socket.mitmResponseSocket) {
        console.log("[recorder] Mocked request, not recording");
        return;
      }

      const { method, protocol, host, path } = request;
      const requestHeaders = request.getHeaders();

      console.log(`[recorder] Writing fixture for ${method} ${path}`);

      const { statusCode, statusMessage, headers: responseHeaders } = response;

      const fixture = {
        request: {
          method,
          protocol,
          host,
          path,
          headers: requestHeaders,
          body: requestBody.length
            ? Buffer.concat(requestBody).toString("base64")
            : undefined,
        },
        response: {
          statusCode,
          statusMessage,
          headers: responseHeaders,
          body: requestBody.length
            ? Buffer.concat(responseBody).toString("base64")
            : undefined,
        },
      };

      fs.mkdirSync(dirname(methodAndPathToFixturesPath(method, path))).catch(
        () => {}
      );
      fs.writeFileSync(
        methodAndPathToFixturesPath(method, path),
        JSON.stringify(fixture, null, 2)
      );
    }
  );
}

function methodAndPathToFixturesPath(method, path) {
  return resolve(
    dirname(fileURLToPath(import.meta.url)),
    "fixtures",
    `${method}-${path.substr(1).replace("/", "-")}.json`
  );
}

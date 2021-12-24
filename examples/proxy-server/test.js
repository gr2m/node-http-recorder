import http from "node:http";

import { test } from "uvu";
import * as assert from "uvu/assert";
import createDeferredPromise from "p-defer";

test("Send GET /get to proxy server", async () => {
  // control flow with deferred promises + timeouts
  const startServer = createDeferredPromise();
  const startServerTimeout = setTimeout(startServer.reject, 10000, "timeout");
  const sendRequest = createDeferredPromise();
  const sendRequestTimeout = setTimeout(sendRequest.reject, 10000, "timeout");

  // capture logs and resolve promisses based on messages
  let port;
  const logs = [];
  const originalLog = console.log;
  console.log = (message, ...replacements) => {
    if (message === "Proxy server listening on http://localhost:%d") {
      clearTimeout(startServerTimeout);
      startServer.resolve();
      port = replacements[0];
    }
    if (message.startsWith("[record] ")) {
      clearTimeout(sendRequestTimeout);
      sendRequest.resolve();
    }

    logs.push(message);
  };

  // run example
  const { server } = await import("./example.js");
  await startServer.promise;

  // send request
  http.get(`http://localhost:${port}/get`);
  await sendRequest.promise;

  // stop server
  server.close();

  // restore console.log
  console.log = originalLog;

  // assertions
  assert.equal(logs, [
    "Proxy server listening on http://localhost:%d",
    `[record] GET http://localhost:${port}/get - 200 OK`,
  ]);
});

test.run();

import http from "node:http";

import { test } from "uvu";
import * as assert from "uvu/assert";

import HttpRecorder from "./index.js";

test.before.each(() => {
  HttpRecorder.disable();
  HttpRecorder.removeAllListeners();
});

test("smoke", () => {
  assert.ok(HttpRecorder);
});

test("happy path", () => {
  const server = http.createServer((_request, response) => {
    response.setHeader("x-my-response-header", 2);
    response.end("World!");
  });
  const { port } = server.listen().address();

  HttpRecorder.enable();
  HttpRecorder.on(
    "record",
    async ({ request, response, requestBody, responseBody }) => {
      const { method, protocol, host, path } = request;
      const requestHeaders = { ...request.getHeaders() };

      try {
        assert.equal(method, "POST");
        assert.equal(protocol, "http:");
        assert.equal(host, "localhost");
        assert.equal(path, "/path");
        assert.equal(requestHeaders, {
          host: "localhost:" + port,
          "x-my-request-header": "1",
        });
        assert.equal(Buffer.concat(requestBody).toString(), "Hello!");

        const {
          statusCode,
          statusMessage,
          headers: responseHeaders,
        } = response;

        assert.equal(statusCode, 200);
        assert.equal(statusMessage, "OK");
        assert.equal(responseHeaders["x-my-response-header"], "2");
        assert.equal(Buffer.concat(responseBody).toString(), "World!");
      } catch (error) {
        if (error.code !== "ERR_ASSERTION") throw error;
        console.log(error.details);
        console.log("expected:", error.expects);
        console.log("actual:", error.actual);
      }
    }
  );

  const request = http.request(
    `http://localhost:${port}/path`,
    {
      method: "post",
      headers: {
        "x-my-request-header": "1",
      },
    },
    () => {
      server.close();
    }
  );
  request.write("Hello!");
  request.end();
});

test("Using request.end", () => {
  const server = http.createServer(async (_request, response) => {
    response.setHeader("x-my-response-header", 2);
    response.end("World!");
  });
  const { port } = server.listen().address();

  HttpRecorder.enable();
  HttpRecorder.on(
    "record",
    async ({ request, response, requestBody, responseBody }) => {
      const { method, protocol, host, path } = request;
      const requestHeaders = { ...request.getHeaders() };

      try {
        assert.equal(method, "POST");
        assert.equal(protocol, "http:");
        assert.equal(host, "localhost");
        assert.equal(path, "/path");
        assert.equal(requestHeaders, {
          host: "localhost:" + port,
          "x-my-request-header": "1",
        });
        assert.equal(Buffer.concat(requestBody).toString(), "Hello!");

        const {
          statusCode,
          statusMessage,
          headers: responseHeaders,
        } = response;

        assert.equal(statusCode, 200);
        assert.equal(statusMessage, "OK");
        assert.equal(responseHeaders["x-my-response-header"], "2");
        assert.equal(Buffer.concat(responseBody).toString(), "World!");
      } catch (error) {
        if (error.code !== "ERR_ASSERTION") throw error;
        console.log(error.details);
        console.log("expected:", error.expects);
        console.log("actual:", error.actual);
      }
    }
  );

  const request = http.request(
    `http://localhost:${port}/path`,
    {
      method: "post",
      headers: {
        "x-my-request-header": "1",
      },
    },
    () => server.close()
  );
  request.end("Hello!");
});

test("Calling .enable() multiple times is a no-op", () => {
  HttpRecorder.enable();
  HttpRecorder.enable();
});

test("Does not emit record event when not enabled", () => {
  HttpRecorder.on("record", () => {
    server.close();
    throw new Error("Should not have been called");
  });

  const server = http.createServer((_request, response) => {
    response.end();
  });
  const { port } = server.listen().address();
  http
    .request(`http://localhost:${port}`, () => {
      server.close();
    })
    .end();
});

test("Does not emit record event handler removed", () => {
  HttpRecorder.enable();
  const callback = () => {
    server.close();
    throw new Error("Should not have been called");
  };
  HttpRecorder.on("record", callback);
  HttpRecorder.off("record", callback);

  const server = http.createServer((_request, response) => {
    response.end();
  });
  const { port } = server.listen().address();
  http
    .request(`http://localhost:${port}`, () => {
      server.close();
    })
    .end();
});

test(".on() throws for unknown event", () => {
  assert.throws(() => HttpRecorder.on("unknown", () => {}));
});
test(".off() throws for unknown event", () => {
  assert.throws(() => HttpRecorder.off("unknown", () => {}));
});

test.run();

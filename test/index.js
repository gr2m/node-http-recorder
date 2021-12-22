import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import url from "node:url";

import { test } from "uvu";
import * as assert from "uvu/assert";

import HttpRecorder from "../index.js";

test.before.each(() => {
  HttpRecorder.disable();
  HttpRecorder.removeAllListeners();
});

test("smoke", () => {
  assert.ok(HttpRecorder);
});

test("happy path", () => {
  return new Promise((reject) => {
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

          resolve();
        } catch (error) {
          reject(error);
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
      (response) => {
        response.on("error", reject);
        response.on("close", () => {
          server.close();
        });
      }
    );
    request.on("error", reject);
    request.write("Hello!");
    request.end();
  });
});

test("emits 'record' event", async () => {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (_request, response) => {
      response.end();
    });
    const { port } = server.listen().address();

    HttpRecorder.enable();
    HttpRecorder.on("record", resolve);

    const request = http.request(`http://localhost:${port}`, () =>
      server.close()
    );
    request.on("error", reject);
    request.end();
  });
});

test("request.write() with base64 encoding", async () => {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (_request, response) => {
      response.end();
    });
    const { port } = server.listen().address();

    HttpRecorder.enable();
    HttpRecorder.on("record", async ({ requestBody }) => {
      try {
        assert.equal(Buffer.concat(requestBody).toString(), "Hello!");
        resolve();
      } catch (error) {
        reject(error);
      }
    });

    const request = http.request(
      `http://localhost:${port}/path`,
      {
        method: "post",
      },
      () => server.close()
    );
    request.on("error", reject);
    request.write(Buffer.from("Hello!").toString("base64"), "base64");
    request.end();
  });
});

test("request.end(text)", () => {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (_request, response) => {
      response.end();
    });
    const { port } = server.listen().address();

    HttpRecorder.enable();
    HttpRecorder.on("record", async ({ requestBody, responseBody }) => {
      try {
        assert.equal(Buffer.concat(requestBody).toString(), "Hello!");
        resolve();
      } catch (error) {
        reject(error);
      }
    });

    const request = http.request(
      `http://localhost:${port}/path`,
      {
        method: "post",
      },
      () => server.close()
    );
    request.on("error", reject);
    request.end("Hello!");
  });
});

test("request.end(callback)", () => {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (_request, response) => {
      response.end();
    });
    const { port } = server.listen().address();

    HttpRecorder.enable();
    HttpRecorder.on("record", async ({ requestBody, responseBody }) => {
      try {
        assert.equal(Buffer.concat(requestBody).toString(), "Hello!");
        resolve();
      } catch (error) {
        reject(error);
      }
    });

    const request = http.request(
      `http://localhost:${port}/path`,
      {
        method: "post",
      },
      (response) => {
        response.on("close", () => {
          server.close();
        });
        try {
          assert.ok(callbackCalled);
        } catch (error) {
          reject(error);
        }
      }
    );
    let callbackCalled = false;
    request.write("Hello!");
    request.end(() => {
      callbackCalled = true;
    });
  });
});

test("https", () => {
  return new Promise((resolve, reject) => {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const server = https.createServer(
      {
        key: fs.readFileSync(path.resolve(__dirname, "key.pem")),
        cert: fs.readFileSync(path.resolve(__dirname, "cert.pem")),
      },
      function (req, res) {
        res.writeHead(200);
        res.end("Hello, World!");
      }
    );
    const { port } = server.listen().address();

    HttpRecorder.enable();
    HttpRecorder.on("record", async ({ responseBody }) => {
      try {
        assert.equal(Buffer.concat(responseBody).toString(), "Hello, World!");
        server.close();
        resolve();
      } catch (error) {
        reject(error);
      }
    });

    const emitWarning = process.emitWarning;
    process.emitWarning = () => {};
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
    const request = https.request(`https://localhost:${port}`, () => {
      process.emitWarning = emitWarning;
    });
    request.end();
  });
});

test("Calling .enable() multiple times is a no-op", () => {
  HttpRecorder.enable();
  HttpRecorder.enable();
});

test("Does not emit record event when not enabled", () => {
  return new Promise((resolve, reject) => {
    HttpRecorder.on("record", () => {
      server.close();
      reject(new Error("Should not have been called"));
    });

    const server = http.createServer((_request, response) => {
      response.end("ok");
    });
    const { port } = server.listen().address();
    http
      .request(`http://localhost:${port}`, (response) => {
        response.on("end", () => {
          server.close();
          resolve();
        });
        response.resume();
      })
      .end();
  });
});

test("Does not emit record event handler removed", () => {
  return new Promise((resolve, reject) => {
    HttpRecorder.enable();
    const callback = () => {
      server.close();
      reject(new Error("Should not have been called"));
    };
    HttpRecorder.on("record", callback);
    HttpRecorder.off("record", callback);

    const server = http.createServer((_request, response) => {
      response.end();
    });
    const { port } = server.listen().address();
    http
      .request(`http://localhost:${port}`, () => {
        server.close(resolve);
      })
      .end();
  });
});

test(".on() throws for unknown event", () => {
  assert.throws(() => HttpRecorder.on("unknown", () => {}));
});
test(".off() throws for unknown event", () => {
  assert.throws(() => HttpRecorder.off("unknown", () => {}));
});

test.run();

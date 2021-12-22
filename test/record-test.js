import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import url from "node:url";
import zlib from "node:zlib";

import { test } from "uvu";
import * as assert from "uvu/assert";

import HttpRecorder from "../index.js";

test.before.each(() => {
  HttpRecorder.disable();
  HttpRecorder.removeAllListeners();
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

test("delayed response read", () => {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (_request, response) => {
      response.write("Hello!");
      response.end();
    });
    const { port } = server.listen().address();

    HttpRecorder.enable();
    HttpRecorder.on("record", async ({ responseBody }) => {
      try {
        assert.equal(Buffer.concat(responseBody).toString(), "Hello!");
        assert.ok(retrievedData);
        resolve();
      } catch (error) {
        reject(error);
      }
    });

    let retrievedData = false;
    http.get(`http://localhost:${port}`, (response) => {
      response.pause();
      response.on("close", () => {
        server.close();
      });
      setTimeout(() => {
        response.on("data", (data) => {
          assert.equal(data.toString(), "Hello!");
          retrievedData = true;
        });
        response.resume();
      }, 100);
    });
  });
});

test("response.end(text)", () => {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (_request, response) => {
      response.end("Hello!");
    });
    const { port } = server.listen().address();

    HttpRecorder.enable();
    let retrievedData = false;
    HttpRecorder.on("record", async ({ responseBody }) => {
      try {
        assert.equal(Buffer.concat(responseBody).toString(), "Hello!");
        retrievedData = true;
        server.close();
        resolve();
      } catch (error) {
        reject(error);
      }
    });

    http.get(`http://localhost:${port}`, async (response) => {
      response.resume();
      for await (const chunk of response) {
        assert.equal(chunk.toString(), "Hello!");
      }
      assert.ok(retrievedData);
    });
  });
});

test("response with content-encoding: deflate", () => {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      response.writeHead(200, {
        "Content-Encoding": "deflate",
        "Content-Type": "text/plain; charset=utf-8",
      });

      zlib.deflate(Buffer.from("Hello!"), (error, buffer) => {
        response.end(buffer);
      });
    });
    const { port } = server.listen().address();

    HttpRecorder.enable();
    HttpRecorder.on("record", async ({ responseBody }) => {
      try {
        zlib.inflate(Buffer.concat(responseBody), (error, buffer) => {
          assert.equal(buffer.toString(), "Hello!");
          server.close();
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });

    http.get(`http://localhost:${port}`);
  });
});

test("response with redirect", () => {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      response.writeHead(302, {
        Location: "https://example.com",
      });
      response.end();
    });
    const { port } = server.listen().address();

    HttpRecorder.enable();
    HttpRecorder.on("record", async ({ response }) => {
      try {
        assert.equal(response.headers.location, "https://example.com");
        server.close();
        resolve();
      } catch (error) {
        reject(error);
      }
    });

    http.get(`http://localhost:${port}`);
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

test.run();

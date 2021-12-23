import fs from "node:fs";

import http from "node:http";
import https from "node:https";
import path from "node:path";
import url from "node:url";
import zlib from "node:zlib";

import { test } from "uvu";
import * as assert from "uvu/assert";

import httpRecorder from "../index.js";

function getFlowControl() {
  const control = {};
  control.promise = new Promise((resolve, reject) => {
    control.resolve = resolve;
    control.reject = reject;
  });

  return control;
}

test.before.each(() => {
  httpRecorder.stop();
  httpRecorder.removeAllListeners();
});

test("happy path", () => {
  const flowControl = getFlowControl();

  const server = http.createServer((_request, response) => {
    response.setHeader("x-my-response-header", 2);
    response.end("World!");
  });
  const { port } = server.listen().address();

  httpRecorder.start();
  httpRecorder.on(
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

        flowControl.resolve();
      } catch (error) {
        flowControl.reject(error);
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
      response.on("error", flowControl.reject);
      response.on("close", () => {
        server.close();
      });
      // must read response
      response.on("data", () => {});
    }
  );
  request.on("error", flowControl.reject);
  request.write("Hello!");
  request.end();

  return flowControl.promise;
});

test("emits 'record' event", async () => {
  const flowControl = getFlowControl();
  const server = http.createServer(async (_request, response) => {
    response.end();
  });
  const { port } = server.listen().address();

  httpRecorder.start();
  httpRecorder.on("record", flowControl.resolve);

  const request = http.request(`http://localhost:${port}`, (response) => {
    response.on("close", () => server.close());
    // must read response
    response.on("data", () => {});
  });
  request.on("error", flowControl.reject);
  request.end();

  return flowControl.promise;
});

test("request.write() with base64 encoding", () => {
  const flowControl = getFlowControl();
  const server = http.createServer(async (_request, response) => {
    response.end();
  });
  const { port } = server.listen().address();

  httpRecorder.start();
  httpRecorder.on("record", async ({ requestBody }) => {
    try {
      assert.equal(Buffer.concat(requestBody).toString(), "Hello!");
      flowControl.resolve();
    } catch (error) {
      flowControl.reject(error);
    }
  });

  const request = http.request(
    `http://localhost:${port}/path`,
    {
      method: "post",
    },
    (response) => {
      response.on("close", () => server.close());
      // must read response
      response.on("data", () => {});
    }
  );
  request.on("error", flowControl.reject);
  request.write(Buffer.from("Hello!").toString("base64"), "base64");
  request.end();

  return flowControl.promise;
});

test("request.write(data, callback)", async () => {
  const recordDataControl = getFlowControl();
  const writeCallbackControl = getFlowControl();

  const server = http.createServer(async (_request, response) => {
    response.end();
  });
  const { port } = server.listen().address();

  httpRecorder.start();
  httpRecorder.on("record", async ({ requestBody }) => {
    try {
      assert.equal(Buffer.concat(requestBody).toString(), "Hello!");
      recordDataControl.resolve();
    } catch (error) {
      recordDataControl.reject(error);
    }
  });

  const request = http.request(
    `http://localhost:${port}/path`,
    {
      method: "post",
    },
    (response) => {
      response.on("close", () => server.close());
      // must read response
      response.on("data", () => {});
    }
  );
  request.on("error", recordDataControl.reject);
  request.write("Hello!", (error) => {
    if (error) return writeCallbackControl.reject(error);
    writeCallbackControl.resolve();
  });
  request.end();

  await recordDataControl.promise;
  await writeCallbackControl.promise;
});

test("request.end(text)", () => {
  const flowControl = getFlowControl();
  const server = http.createServer(async (_request, response) => {
    response.end();
  });
  const { port } = server.listen().address();

  httpRecorder.start();
  httpRecorder.on("record", async ({ requestBody, responseBody }) => {
    try {
      assert.equal(Buffer.concat(requestBody).toString(), "Hello!");
      flowControl.resolve();
    } catch (error) {
      flowControl.reject(error);
    }
  });

  const request = http.request(
    `http://localhost:${port}/path`,
    {
      method: "post",
    },
    (response) => {
      response.on("close", () => server.close());
      // must read response
      response.on("data", () => {});
    }
  );
  request.on("error", flowControl.reject);
  request.end("Hello!");

  return flowControl.promise;
});

test("request.end(callback)", async () => {
  const recordControl = getFlowControl();
  const callbackControl = getFlowControl();
  const server = http.createServer(async (_request, response) => {
    response.end();
  });
  const { port } = server.listen().address();

  httpRecorder.start();
  httpRecorder.on("record", async ({ requestBody, responseBody }) => {
    try {
      assert.equal(Buffer.concat(requestBody).toString(), "Hello!");
      recordControl.resolve();
    } catch (error) {
      recordControl.reject(error);
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
      // must read response
      response.on("data", () => {});
    }
  );
  request.write("Hello!");
  request.end(callbackControl.resolve);

  await callbackControl.promise;
  await recordControl.promise;
});

test("delayed response read", async () => {
  const recordDataControl = getFlowControl();
  const responseDataControl = getFlowControl();
  const timeoutControl = getFlowControl();

  const server = http.createServer(async (_request, response) => {
    response.write("Hello!");
    response.end();
  });
  const { port } = server.listen().address();

  httpRecorder.start();
  let retrievedRecordData = false;
  httpRecorder.on("record", async ({ responseBody }) => {
    try {
      assert.equal(Buffer.concat(responseBody).toString(), "Hello!");
      retrievedRecordData = true;
      recordDataControl.resolve();
    } catch (error) {
      recordDataControl.reject(error);
    }
  });

  let retrievedResponseData = false;
  http.get(`http://localhost:${port}`, (response) => {
    setTimeout(() => {
      response.on("close", () => {
        clearTimeout(timeout);
        timeoutControl.resolve();
        server.close();
      });

      response.on("data", (data) => {
        try {
          assert.equal(data.toString(), "Hello!");
          retrievedResponseData = true;
          responseDataControl.resolve();
        } catch (error) {
          responseDataControl.reject(error);
        }
      });
    }, 10);
  });

  const timeout = setTimeout(() => {
    server.close();
    timeoutControl.reject(new Error("Timeout"));
  }, 1000);

  await timeoutControl.promise;
  await recordDataControl.promise;
  await responseDataControl.promise;

  assert.ok(retrievedRecordData);
  assert.ok(retrievedResponseData);
});

test("response.end(text)", async () => {
  const recordDataControl = getFlowControl();
  const responseDataControl = getFlowControl();

  const server = http.createServer(async (_request, response) => {
    response.end("Hello!");
  });
  const { port } = server.listen().address();

  httpRecorder.start();
  let retrievedRecordData = false;
  httpRecorder.on("record", async ({ responseBody }) => {
    try {
      assert.equal(Buffer.concat(responseBody).toString(), "Hello!");
      retrievedRecordData = true;
      recordDataControl.resolve();
    } catch (error) {
      recordDataControl.reject(error);
    }
  });

  let retrievedResponseData = false;
  http.get(`http://localhost:${port}`, async (response) => {
    response.on("close", () => server.close());
    try {
      for await (const chunk of response) {
        assert.equal(chunk.toString(), "Hello!");
        retrievedResponseData = true;
      }
      responseDataControl.resolve();
    } catch (error) {
      responseDataControl.reject();
    }
  });

  await recordDataControl.promise;
  await responseDataControl.promise;

  assert.ok(retrievedRecordData);
  assert.ok(retrievedResponseData);
});

test("response with content-encoding: deflate", () => {
  const flowControl = getFlowControl();
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

  httpRecorder.start();
  httpRecorder.on("record", async ({ responseBody }) => {
    try {
      zlib.inflate(Buffer.concat(responseBody), (error, buffer) => {
        try {
          assert.equal(buffer.toString(), "Hello!");
          flowControl.resolve();
        } catch (error) {
          flowControl.reject(error);
        }
      });
    } catch (error) {
      flowControl.reject(error);
    }
  });

  http.get(`http://localhost:${port}`, (response) => {
    response.on("close", () => server.close());
    // must read response
    response.on("data", () => {});
  });

  return flowControl.promise;
});

test("response with redirect", () => {
  const flowControl = getFlowControl();
  const server = http.createServer((request, response) => {
    response.writeHead(302, {
      Location: "https://example.com",
    });
    response.end();
  });
  const { port } = server.listen().address();

  httpRecorder.start();
  httpRecorder.on("record", async ({ response }) => {
    try {
      assert.equal(response.headers.location, "https://example.com");
      flowControl.resolve();
    } catch (error) {
      flowControl.reject(error);
    }
  });

  http.get(`http://localhost:${port}`, (response) => {
    response.on("close", () => server.close());
    // must read response
    response.on("data", () => {});
  });

  return flowControl.promise;
});

test("response.read()", async () => {
  const recordControl = getFlowControl();
  const requestControl = getFlowControl();

  const server = http.createServer((request, response) => {
    response.end("Hello!");
  });
  const { port } = server.listen().address();

  httpRecorder.start();
  httpRecorder.on("record", async ({ responseBody }) => {
    try {
      assert.equal(Buffer.concat(responseBody).toString(), "Hello!");
      recordControl.resolve();
    } catch (error) {
      recordControl.reject(error);
    }
  });

  http
    .get(`http://localhost:${port}`, (response) => {
      response.on("close", () => {
        server.close();
        requestControl.resolve();
      });
      response.on("error", requestControl.reject);
      // must read response
      response.on("readable", () => {
        const data = response.read();
        assert.equal(data.toString(), "Hello!");
      });
    })
    .on("error", requestControl.reject);

  await recordControl.promise;
  await requestControl.promise;
});

test("https", () => {
  const flowControl = getFlowControl();

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

  httpRecorder.start();
  httpRecorder.on("record", async ({ responseBody }) => {
    try {
      assert.equal(Buffer.concat(responseBody).toString(), "Hello, World!");
      flowControl.resolve();
    } catch (error) {
      flowControl.reject(error);
    }
  });

  const emitWarning = process.emitWarning;
  process.emitWarning = () => {};
  process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
  const request = https.request(`https://localhost:${port}`, (response) => {
    process.emitWarning = emitWarning;
    response.on("close", () => server.close());
    // must read response
    response.on("data", () => {});
  });
  request.on("error", flowControl.reject);
  request.end();

  return flowControl.promise;
});

test.run();

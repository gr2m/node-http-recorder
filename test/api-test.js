import http from "node:http";

import { test } from "uvu";
import * as assert from "uvu/assert";

import HttpRecorder from "../index.js";

function getFlowControl() {
  const control = {};
  control.promise = new Promise((resolve, reject) => {
    control.resolve = resolve;
    control.reject = reject;
  });

  return control;
}

test.before.each(() => {
  HttpRecorder.disable();
  HttpRecorder.removeAllListeners();
});

test("smoke", () => {
  assert.ok(HttpRecorder);
});

test("Calling .enable() multiple times is a no-op", () => {
  HttpRecorder.enable();
  HttpRecorder.enable();
});

test("Does not emit record event when not enabled", () => {
  const flowControl = getFlowControl();

  HttpRecorder.on("record", () => {
    server.close();
    flowControl.reject(new Error("Should not have been called"));
  });

  const server = http.createServer((_request, response) => {
    response.end("ok");
  });
  const { port } = server.listen().address();
  http
    .request(`http://localhost:${port}`, (response) => {
      response.on("close", () => server.close(flowControl.resolve));
      // must read data
      response.on("data", () => {});
    })
    .on("error", flowControl.reject)
    .end();

  return flowControl.promise;
});

test("Does not emit record event handler removed", () => {
  const flowControl = getFlowControl();

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
    .request(`http://localhost:${port}`, (response) => {
      response.on("close", () => server.close(flowControl.resolve));
      // must read data
      response.on("data", () => {});
    })
    .on("error", flowControl.reject)
    .end();

  return flowControl.promise;
});

test(".on() throws for unknown event", () => {
  assert.throws(() => HttpRecorder.on("unknown", () => {}));
});

test(".off() throws for unknown event", () => {
  assert.throws(() => HttpRecorder.off("unknown", () => {}));
});

test(".disable() does not revert other patches", async () => {
  const hookControl = getFlowControl();
  const requestControl = getFlowControl();

  HttpRecorder.enable();

  const origOnSocket = http.ClientRequest.prototype.onSocket;
  http.ClientRequest.prototype.onSocket = function (socket) {
    hookControl.resolve();
    return origOnSocket.call(this, socket);
  };
  HttpRecorder.disable();

  const server = http.createServer((_request, response) => {
    response.end("ok");
  });
  const { port } = server.listen().address();
  http
    .request(`http://localhost:${port}`, (response) => {
      response.on("close", () => server.close(requestControl.resolve));
      response.on("error", requestControl.reject);
      // must read data
      response.on("data", () => {});
    })
    .on("error", requestControl.reject)
    .end();

  const timeout = setTimeout(
    () => hookControl.reject(new Error("Timeout")),
    1000
  );

  await requestControl.promise;
  await hookControl.promise;

  clearTimeout(timeout);
});

test.run();

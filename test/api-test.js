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
    reject(new Error("Should not have been called"));
  });

  const server = http.createServer((_request, response) => {
    response.end("ok");
  });
  const { port } = server.listen().address();
  http
    .request(`http://localhost:${port}`, (response) => {
      response.on("close", () => server.close(flowControl.resolve));
      response.resume();
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

test.run();

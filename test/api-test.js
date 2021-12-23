import http from "node:http";

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

test("smoke", () => {
  assert.ok(httpRecorder);
});

test("Calling .start() multiple times is a no-op", () => {
  httpRecorder.start();
  httpRecorder.start();
});

test("Does not emit record event when not started", () => {
  const flowControl = getFlowControl();

  httpRecorder.addListener("record", () => {
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

  httpRecorder.start();
  const callback = () => {
    server.close();
    reject(new Error("Should not have been called"));
  };
  httpRecorder.addListener("record", callback);
  httpRecorder.removeListener("record", callback);

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
  try {
    httpRecorder.on("unknown", () => {});
    assert.not.ok("should throw");
  } catch (error) {
    assert.ok(error);
  }
});

test(".off() throws for unknown event", () => {
  try {
    httpRecorder.off("unknown", () => {});
    assert.not.ok("should throw");
  } catch (error) {
    assert.ok(error);
  }
});

test(".stop() does not revert other patches", async () => {
  const hookControl = getFlowControl();
  const requestControl = getFlowControl();

  httpRecorder.start();

  const origOnSocket = http.ClientRequest.prototype.onSocket;
  http.ClientRequest.prototype.onSocket = function (socket) {
    hookControl.resolve();
    return origOnSocket.call(this, socket);
  };
  httpRecorder.stop();

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

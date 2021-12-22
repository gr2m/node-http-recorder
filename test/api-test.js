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

test("smoke", () => {
  assert.ok(HttpRecorder);
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
        response.on("close", () => server.close(resolve));
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
      .request(`http://localhost:${port}`, (response) => {
        response.on("close", () => server.close(resolve));
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

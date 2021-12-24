import fs from "node:fs/promises";
import path from "path";
import url from "url";

import { test } from "uvu";
import * as assert from "uvu/assert";
import createDeferredPromise from "p-defer";

import recorder from "../../index.js";

const fixturesPath = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "fixtures"
);

test("Record first request, replay 2nd request", async () => {
  // control flow with deferred promises + timeouts
  const firstRequest = createDeferredPromise();
  const firstRequestTimeout = setTimeout(firstRequest.reject, 10000, "timeout");
  const secondRequest = createDeferredPromise();
  const secondRequestTimeout = setTimeout(
    secondRequest.reject,
    10000,
    "timeout"
  );

  // delete fixtures directory if present
  await fs.rm(fixturesPath, { recursive: true }).catch(() => {});

  // capture logs and resolve promisses based on messages
  const logs = [];
  const originalLog = console.log;
  console.log = (message) => {
    if (message === "[recorder] Writing fixture for POST /post") {
      clearTimeout(firstRequestTimeout);
      firstRequest.resolve();
    }
    if (message === "[recorder] Mocked request, not recording") {
      clearTimeout(secondRequestTimeout);
      secondRequest.resolve();
    }

    logs.push(message);
  };

  // run example for first time, recording fixtures
  await import("./example.js?1");
  await firstRequest.promise;

  // remove all "record" listeners to avoid double firings
  recorder.removeAllListeners();

  // run example for second time, replaying fixtures
  await import("./example.js?2");
  await secondRequest.promise;

  // restore console.log
  console.log = originalLog;

  // assertions
  const recordedResponseData = JSON.parse(logs[1]);
  assert.equal(logs[0], "[Mitm] recording fixture for POST /post");
  assert.equal(JSON.parse(logs[1]), recordedResponseData);
  assert.equal(logs[2], "[recorder] Writing fixture for POST /post");
  assert.equal(logs[3], "[Mitm] fixture found for POST /post");
  assert.equal(JSON.parse(logs[4]), recordedResponseData);
  assert.equal(logs[5], "[recorder] Mocked request, not recording");
});

test.run();

import http from "node:http";

import { expectType } from "tsd";
import HttpRecorder from "./index.js";

export function smokeTest() {
  expectType<typeof HttpRecorder>(HttpRecorder);
}

export function API() {
  expectType<typeof HttpRecorder>(HttpRecorder.enable());
  expectType<typeof HttpRecorder>(HttpRecorder.disable());
  expectType<typeof HttpRecorder>(HttpRecorder.on("record", () => {}));
  expectType<typeof HttpRecorder>(HttpRecorder.off("record", () => {}));
  expectType<typeof HttpRecorder>(HttpRecorder.removeAllListeners());

  // @ts-expect-error - only "record" is supported
  HttpRecorder.on("not-record", () => {});
}

export function recordHandler() {
  HttpRecorder.on("record", (options) => {
    expectType<http.ClientRequest>(options.request);
    expectType<http.IncomingMessage>(options.response);
    expectType<Buffer[]>(options.requestBody);
    expectType<Buffer[]>(options.responseBody);
  });
}

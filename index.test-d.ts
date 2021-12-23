import http from "node:http";

import { expectType } from "tsd";
import httpRecorder from "./index.js";

export function smokeTest() {
  expectType<typeof httpRecorder>(httpRecorder);
}

export function API() {
  expectType<typeof httpRecorder>(httpRecorder.start());
  expectType<typeof httpRecorder>(httpRecorder.stop());
  expectType<typeof httpRecorder>(httpRecorder.addListener("record", () => {}));
  expectType<typeof httpRecorder>(
    httpRecorder.removeListener("record", () => {})
  );
  expectType<typeof httpRecorder>(httpRecorder.removeAllListeners());

  // @ts-expect-error - only "record" is supported
  httpRecorder.addListener("not-record", () => {});
}

export function recordHandler() {
  httpRecorder.addListener("record", (options) => {
    expectType<http.ClientRequest>(options.request);
    expectType<http.IncomingMessage>(options.response);
    expectType<Buffer[]>(options.requestBody);
    expectType<Buffer[]>(options.responseBody);
  });
}

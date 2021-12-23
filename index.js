// @ts-check

import { EventEmitter } from "node:events";
import http from "node:http";

import intercept from "./lib/intercept.js";

const emitter = new EventEmitter();
let isEnabled = false;
let isPatched = false;

export default {
  enable() {
    if (isEnabled) return;
    isEnabled = true;

    if (isPatched) return;
    isPatched = true;

    // hook into `http.Server.prototype.onSocket` in order to get
    // access to the `http.ClientRequest` instance of every request
    // sent using the `http(s)` modules.
    const origOnSocket = http.ClientRequest.prototype.onSocket;
    http.ClientRequest.prototype.onSocket = function (socket) {
      if (isEnabled && emitter.listenerCount("record") > 0) {
        intercept(this, emitter);
      }

      // run the original `http.Server.prototype.onSocket` method
      // and return its value
      return origOnSocket.call(this, socket);
    };

    return this;
  },
  disable() {
    isEnabled = false;
    return this;
  },
  on(eventName, callback) {
    if (eventName !== "record")
      throw new Error("Only 'record' events are supported");

    emitter.on("record", callback);
    return this;
  },
  off(eventName, callback) {
    if (eventName !== "record")
      throw new Error("Only 'record' events are supported");

    emitter.off("record", callback);
    return this;
  },
  removeAllListeners() {
    emitter.removeAllListeners();
    return this;
  },
};

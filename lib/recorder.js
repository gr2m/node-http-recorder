// @ts-check

import { EventEmitter } from "node:events";
import http from "node:http";

import intercept from "./intercept.js";

let isRecording = false;
let didPatchHttpClientRequest = false;

export default class Recorder extends EventEmitter {
  constructor() {
    super();

    // we only support the "record" event
    this.on("newListener", (eventName) => {
      if (eventName === "record") return;
      throw new Error("Only 'record' events are supported");
    });
  }

  removeAllListeners() {
    return EventEmitter.prototype.removeAllListeners.call(this, "record");
  }

  start() {
    if (isRecording) return;
    isRecording = true;

    if (didPatchHttpClientRequest) return;
    didPatchHttpClientRequest = true;

    // hook into `http.Server.prototype.onSocket` in order to intercept the
    // `http.ClientRequest` instance of every http(s) request
    const origOnSocket = http.ClientRequest.prototype.onSocket;
    const recorder = this;
    http.ClientRequest.prototype.onSocket = function (socket) {
      if (isRecording) intercept(this, recorder);

      // run the original `http.Server.prototype.onSocket` method
      // and return its value
      return origOnSocket.call(this, socket);
    };

    return this;
  }

  stop() {
    isRecording = false;
    return this;
  }
}

// @ts-check

import { EventEmitter } from "node:events";
import http from "node:http";

const emitter = new EventEmitter();
let origOnSocket;

export default {
  enable() {
    if (origOnSocket) {
      // already enabled
      return;
    }

    // hook into `http.Server.prototype.onSocket` in order to get
    // access to the `http.ClientRequest` instance of every request
    // sent using the `http(s)` modules.
    origOnSocket = http.ClientRequest.prototype.onSocket;
    http.ClientRequest.prototype.onSocket = function (socket) {
      const interceptedRequest = this;

      // read the request body as an array of Buffer chuncks
      // by hooking into the `request.write` method.
      const requestBodyChunks = [];
      const originalRequestWrite = interceptedRequest.write;
      interceptedRequest.write = function (chunk) {
        requestBodyChunks.push(Buffer.from(chunk));
        return originalRequestWrite.call(this, chunk);
      };

      interceptedRequest.on("response", async (response) => {
        // read the response body as an array of Buffer chuncks
        const responseBodyChunks = [];
        for await (const chunk of response) {
          responseBodyChunks.push(Buffer.from(chunk));
        }

        // emit the `request` event with the request and response body
        emitter.emit("record", {
          request: interceptedRequest,
          requestBody: requestBodyChunks,
          response,
          responseBody: responseBodyChunks,
        });
      });

      // run the original `http.Server.prototype.onSocket` method
      // and return its value
      return origOnSocket.call(this, socket);
    };

    return this;
  },
  disable() {
    if (origOnSocket) {
      http.ClientRequest.prototype.onSocket = origOnSocket;
      origOnSocket = undefined;
    }
    return this;
  },
  on(eventName, callback) {
    if (eventName !== "record") {
      throw new Error("Only 'record' events are supported");
    }

    emitter.on("record", callback);
    return this;
  },
  off(eventName, callback) {
    if (eventName !== "record") {
      throw new Error("Only 'record' events are supported");
    }

    emitter.off("record", callback);
    return this;
  },
  removeAllListeners() {
    emitter.removeAllListeners();
    return this;
  },
};

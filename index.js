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

    origOnSocket = http.ClientRequest.prototype.onSocket;
    http.ClientRequest.prototype.onSocket = function (socket) {
      const interceptedRequest = this;

      const requestBodyChunks = [];
      const originalRequestWrite = interceptedRequest.write;
      interceptedRequest.write = function (chunk) {
        requestBodyChunks.push(Buffer.from(chunk));
        return originalRequestWrite.call(this, chunk);
      };

      interceptedRequest.on("response", async (response) => {
        const responseBodyChunks = [];
        for await (const chunk of response) {
          responseBodyChunks.push(Buffer.from(chunk));
        }

        emitter.emit("record", {
          request: interceptedRequest,
          requestBody: requestBodyChunks,
          response,
          responseBody: responseBodyChunks,
        });
      });

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

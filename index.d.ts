import { EventEmitter } from "events";
import http from "http";

declare class Recorder extends EventEmitter {
  /**
   * Start recording and emitting "record" events.
   * No-op if already recording.
   */
  start: () => this;

  /**
   * Stop recording and emitting "record" events.
   * No-op if not recording.
   */
  stop: () => this;

  /**
   * Subscribe to the "record" event, emitted each time a response closes.
   */
  addListener: (event: "record", listener: RecordHandler) => this;

  /**
   * Unsubscribe from the "record" event using the same listener function
   * that was used when subscribing.
   */
  removeListener: (event: "record", listener: RecordHandler) => this;

  /**
   * Remove all listeners from the "record" event.
   */
  removeAllListeners(): this;
}

declare const recorder: Recorder;

export default recorder;

export interface RecordHandler {
  (options: RecordHandlerOptions): void | Promise<void>;
}

export type RecordHandlerOptions = {
  /**
   * The http(s) request that was sent.
   */
  request: http.ClientRequest;

  /**
   * The http(s) response that was received
   */
  response: http.IncomingMessage;

  /**
   * Array of buffers from the request body.
   */
  requestBody: Buffer[];

  /**
   * Array of buffers from the response body.
   */
  responseBody: Buffer[];
};

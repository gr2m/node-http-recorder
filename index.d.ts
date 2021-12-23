import http from "http";

declare const httpRecorder: {
  start: () => typeof httpRecorder;
  stop: () => typeof httpRecorder;
  on: (event: "record", listener: RecordHandler) => typeof httpRecorder;
  off: (event: "record", listener: RecordHandler) => typeof httpRecorder;
  removeAllListeners: () => typeof httpRecorder;
};

export default httpRecorder;

export interface RecordHandler {
  (options: RecordHandlerOptions): void | Promise<void>;
}

export type RecordHandlerOptions = {
  request: http.ClientRequest;
  response: http.IncomingMessage;
  requestBody: Buffer[];
  responseBody: Buffer[];
};

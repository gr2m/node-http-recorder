import http from "http";

declare const HttpRecorder: {
  enable: () => typeof HttpRecorder;
  disable: () => typeof HttpRecorder;
  on: (event: "record", listener: RecordHandler) => typeof HttpRecorder;
  off: (event: "record", listener: RecordHandler) => typeof HttpRecorder;
  removeAllListeners: () => typeof HttpRecorder;
};

export default HttpRecorder;

export interface RecordHandler {
  (options: RecordHandlerOptions): void | Promise<void>;
}

export type RecordHandlerOptions = {
  request: http.ClientRequest;
  response: http.IncomingMessage;
  requestBody: Buffer[];
  responseBody: Buffer[];
};

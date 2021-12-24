import http from "node:http";

import recorder from "../../index.js";

recorder.start();
recorder.addListener("record", async ({ request, response }) => {
  const { host } = request.getHeaders();

  console.log(
    `[record] ${request.method} ${request.protocol}//${host}${request.path} - ${response.statusCode} ${response.statusMessage}`
  );
});

export const server = http.createServer(async (request, response) => {
  const options = {
    hostname: "httpbin.org",
    port: 80,
    path: request.url,
    method: request.method,
    headers: request.headers,
  };

  const proxy = http.request(options, function (proxyResponse) {
    response.writeHead(proxyResponse.statusCode, proxyResponse.headers);
    proxyResponse.pipe(response, { end: true });
  });

  request.pipe(proxy, { end: true });
});
const { port } = server.listen(process.env.PORT).address();
console.log("Proxy server listening on http://localhost:%d", port);

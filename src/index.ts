/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2018-2022 TypeFox GmbH (http://www.typefox.io). All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import * as ws from "ws";
import * as http from "http";
import * as https from "https";
import * as url from "url";
import * as net from "net";
import express from "express";
import * as rpc from "vscode-ws-jsonrpc/cjs";
import { launch } from "./json-server-launcher";
import fs from "fs";

process.on("uncaughtException", function (err: any) {
  console.error("Uncaught Exception: ", err.toString());
  if (err.stack) {
    console.error(err.stack);
  }
});

const privateKey = fs.readFileSync(
  "/etc/letsencrypt/live/lsp.usaco.guide/privkey.pem",
  "utf8"
);
const certificate = fs.readFileSync(
  "/etc/letsencrypt/live/lsp.usaco.guide/fullchain.pem",
  "utf8"
);

// create the express application
const app = express();
// server the static content, i.e. index.html
app.use(express.static(__dirname));
// start the server
// const server = app.listen(3000);
const httpsServer = https.createServer(
  { key: privateKey, cert: certificate },
  app
);
httpsServer.listen(3000);
// create the web socket
const wss = new ws.Server({
  noServer: true,
  perMessageDeflate: false,
});
httpsServer.on(
  "upgrade",
  (request: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
    // eslint-disable-next-line n/no-deprecated-api
    const pathname = request.url ? url.parse(request.url).pathname : undefined;
    if (pathname === "/sampleServer") {
      wss.handleUpgrade(request, socket, head, (webSocket) => {
        const socket: rpc.IWebSocket = {
          send: (content) =>
            webSocket.send(content, (error) => {
              if (error) {
                throw error;
              }
            }),
          onMessage: (cb) => webSocket.on("message", cb),
          onError: (cb) => webSocket.on("error", cb),
          onClose: (cb) => webSocket.on("close", cb),
          dispose: () => webSocket.close(),
        };
        // launch the server when the web socket is opened
        if (webSocket.readyState === webSocket.OPEN) {
          launch(socket);
        } else {
          webSocket.on("open", () => launch(socket));
        }
      });
    }
  }
);

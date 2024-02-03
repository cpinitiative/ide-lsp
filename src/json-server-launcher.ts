/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2018-2022 TypeFox GmbH (http://www.typefox.io). All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import * as rpc from "vscode-ws-jsonrpc/cjs";
import * as server from "vscode-ws-jsonrpc/cjs/server";
import * as lsp from "vscode-languageserver";
import { Message } from "vscode-languageserver";
let connections = 0;
const MAX_CONNECTIONS = 40;
export function launch(socket: rpc.IWebSocket) {
  const reader = new rpc.WebSocketMessageReader(socket);
  const writer = new rpc.WebSocketMessageWriter(socket);
  let lastDate = new Date();
  if (connections >= MAX_CONNECTIONS) {
    writer.write({ jsonrpc: '2.0', method: 'reject' } as rpc.NotificationMessage);
    console.log(`rejected connection at ${new Date()} (connections: ${connections})`)
    return;
  }
  console.log(`at ${new Date()} - ${++connections} connections`);
  writer.write({ jsonrpc: '2.0', method: 'start' } as rpc.NotificationMessage);
  // start the language server as an external process
  const socketConnection = server.createConnection(reader, writer, () => {
      --connections;
      socket.dispose();
    }
  );
  const serverConnection = server.createServerProcess("CPP", "clangd-12");
  const id = setInterval(() => {
    if (new Date().getTime() - lastDate.getTime() > 30000) {
      console.log('connection timed out!');
      serverConnection?.dispose();
      socketConnection.dispose();
      clearInterval(id);
    }
  }, 10000)
  if (serverConnection) {
    server.forward(socketConnection, serverConnection, (message) => {
      if (Message.isRequest(message)) {
        if (message.method === lsp.InitializeRequest.type.method) {
          const initializeParams = message.params as lsp.InitializeParams;
          initializeParams.processId = process.pid;
        }
      }
      else if (Message.isNotification(message)) {
        if (message.method === 'ping') {
          lastDate = new Date();
        }
      }
      return message;
    });
  }
}

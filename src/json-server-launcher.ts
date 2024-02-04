/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2018-2022 TypeFox GmbH (http://www.typefox.io). All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import * as rpc from "vscode-ws-jsonrpc/cjs";
import * as server from "vscode-ws-jsonrpc/cjs/server";
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
  console.log(`new connection at ${new Date()} - ${++connections} connections`);
  writer.write({ jsonrpc: '2.0', method: 'start' } as rpc.NotificationMessage);
  let socketConnection: server.IConnection | undefined;
  let serverConnection: server.IConnection | undefined;
  let disposed = false;
  const pingId = setInterval(() => {
    if (new Date().getTime() - lastDate.getTime() > 30000) {
      console.log('connection timed out!');
      dispose();
    }
  }, 10000);
  
  function dispose() {
    if (disposed) return;
    disposed = true;
    console.log(`closed connection at ${new Date()} - ${--connections} connections`);
    serverConnection?.dispose();
    socketConnection?.dispose();
    clearInterval(pingId);
  }
  
  // start the language server as an external process
  socketConnection = server.createConnection(reader, writer, socket.dispose);
  socketConnection.onClose(dispose);
  serverConnection = server.createServerProcess("CPP", "clangd-12");
  reader.listen(message => {
    if (Message.isNotification(message) && message.method === 'ping') {
      lastDate = new Date();
    }
    else serverConnection?.writer.write(message);
  });
  serverConnection?.reader.listen(message => {
    writer.write(message);
  })
}

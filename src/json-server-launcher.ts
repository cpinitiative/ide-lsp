/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2018-2022 TypeFox GmbH (http://www.typefox.io). All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import * as rpc from 'vscode-ws-jsonrpc/cjs';
import * as server from 'vscode-ws-jsonrpc/cjs/server';
import { Message } from 'vscode-languageserver';
let connections = 0;
const MAX_CONNECTIONS = 40;
// tweak from https://github.com/TypeFox/monaco-languageclient/blob/168dce83ab054de88f1c9a8f78b8581da8228632/packages/vscode-ws-jsonrpc/src/server/connection.ts#L16
// to allow message interception
function forward(
  from: server.IConnection,
  to: server.IConnection,
  map?: (message: Message) => Message | undefined
) {
  from.reader.listen(message => {
    const res = map ? map(message) : message;
    if (res) to.writer.write(res);
  });
  to.reader.listen(message => {
    const res = map ? map(message) : message;
    if (res) from.writer.write(res);
  });
  from.onClose(() => to.dispose());
  to.onClose(() => from.dispose());
}
export function launch(socket: rpc.IWebSocket) {
  const reader = new rpc.WebSocketMessageReader(socket);
  const writer = new rpc.WebSocketMessageWriter(socket);
  let lastDate = new Date();
  if (connections >= MAX_CONNECTIONS) {
    writer.write({
      jsonrpc: '2.0',
      method: 'reject',
    } as rpc.NotificationMessage);
    console.log(
      `rejected connection at ${new Date()} (connections: ${connections})`
    );
    return;
  }
  console.log(`new connection at ${new Date()} - ${++connections} connections`);
  writer.write({ jsonrpc: '2.0', method: 'start' } as rpc.NotificationMessage);
  let socketConnection: server.IConnection | undefined;
  let serverConnection: server.IConnection | undefined;
  const pingId = setInterval(() => {
    if (new Date().getTime() - lastDate.getTime() > 30000) {
      console.log('connection timed out!');
      socketConnection?.dispose();
    }
  }, 10000);

  // start servers
  socketConnection = server.createConnection(reader, writer, () => {
    console.log(
      `closed connection at ${new Date()} - ${--connections} connections`
    );
    clearInterval(pingId);
  });

  serverConnection = server.createServerProcess('CPP', 'clangd-12');
  if (!serverConnection) return;
  forward(socketConnection, serverConnection, message => {
    if (Message.isNotification(message) && message.method === 'ping') {
      lastDate = new Date();
      return undefined;
    } else return message;
  });
}

/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2018-2022 TypeFox GmbH (http://www.typefox.io). All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import * as rpc from "vscode-ws-jsonrpc/cjs";
import * as server from "vscode-ws-jsonrpc/cjs/server";
import * as lsp from "vscode-languageserver";
import { Message } from "vscode-languageserver";

export function launch(socket: rpc.IWebSocket) {
  const reader = new rpc.WebSocketMessageReader(socket);
  const writer = new rpc.WebSocketMessageWriter(socket);

  // start the language server as an external process
  const socketConnection = server.createConnection(reader, writer, () =>
    socket.dispose()
  );
  const serverConnection = server.createServerProcess("CPP", "clangd-12");
  if (serverConnection) {
    server.forward(socketConnection, serverConnection, (message) => {
      if (Message.isRequest(message)) {
        if (message.method === lsp.InitializeRequest.type.method) {
          const initializeParams = message.params as lsp.InitializeParams;
          initializeParams.processId = process.pid;
        }
      }
      return message;
    });
  }
}

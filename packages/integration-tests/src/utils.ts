import { io, Socket } from "socket.io-client";
import Websockets from "libp2p-websockets";
import { createAction, PayloadAction } from "@reduxjs/toolkit";
import { all, call, fork, put, take, takeEvery } from "typed-redux-saga";
import waggle from "waggle";
import { StoreKeys, app, errors, prepareStore, useIO } from "@zbayapp/nectar";
import path from "path";
import assert from "assert";
import getPort from "get-port";
import tmp from "tmp";
import logger from "./logger";

const log = logger();

export const createTmpDir = (prefix: string) => {
  return tmp.dirSync({ mode: 0o750, prefix, unsafeCleanup: true });
};

export const createPath = (dirName: string) => {
  return path.join(dirName, ".nectar");
};

const connectToDataport = (url: string, name: string): Socket => {
  const socket = io(url);
  socket.on("connect", async () => {
    log(`websocket connection is ready for app ${name}`);
  });
  socket.on("disconnect", () => {
    log(`socket disconnected for app ${name}`);
    socket.close();
  });
  return socket;
};

export const createApp = async (mockedState?: { [key in StoreKeys]?: any }) => {
  /**
   * Configure and initialize ConnectionsManager from waggle,
   * configure redux store
   */
  const appName = (Math.random() + 1).toString(36).substring(7);
  log(`Creating test app for ${appName}`);
  const dataServerPort1 = await getPort({ port: 4677 });
  const server1 = new waggle.DataServer(dataServerPort1);
  await server1.listen();

  const { store, runSaga } = prepareStore(mockedState);

  const proxyPort = await getPort({ port: 1234 });
  const controlPort = await getPort({ port: 5555 });
  const httpTunnelPort = await getPort({ port: 9000 });
  const manager = new waggle.ConnectionsManager({
    agentHost: "localhost",
    agentPort: proxyPort,
    httpTunnelPort,
    options: {
      env: {
        appDataPath: createPath(
          createTmpDir(`zbayIntegrationTest-${appName}`).name
        ),
      },
      torControlPort: controlPort,
    },
    io: server1.io,
  });
  await manager.init();

  function* root(): Generator {
    const socket = yield* call(
      connectToDataport,
      `http://localhost:${dataServerPort1}`,
      appName
    );
    // @ts-expect-error
    const task = yield* fork(useIO, socket);
    yield* take(createAction("testFinished"));
    yield* put(app.actions.closeServices());
  }

  const rootTask = runSaga(root);

  return { store, runSaga, rootTask, manager };
};

export const createAppWithoutTor = async (mockedState?: {
  [key in StoreKeys]?: any;
}) => {
  /**
   * Configure and initialize ConnectionsManager from waggle,
   * configure redux store
   */
  const appName = (Math.random() + 1).toString(36).substring(7);
  log(`Creating test app for ${appName}`);
  const dataServerPort1 = await getPort({ port: 4677 });
  const server1 = new waggle.DataServer(dataServerPort1);
  await server1.listen();

  const { store, runSaga } = prepareStore(mockedState);

  const proxyPort = await getPort({ port: 1234 });
  const controlPort = await getPort({ port: 5555 });
  const httpTunnelPort = await getPort({ port: 9000 });
  const manager = new waggle.ConnectionsManager({
    agentHost: "localhost",
    agentPort: proxyPort,
    httpTunnelPort,
    options: {
      env: {
        appDataPath: createPath(
          createTmpDir(`zbayIntegrationTest-${appName}`).name
        ),
      },
      libp2pTransportClass: Websockets,
      torControlPort: controlPort,
    },
    io: server1.io,
  });
  manager.initListeners();

  function* root(): Generator {
    const socket = yield* call(
      connectToDataport,
      `http://localhost:${dataServerPort1}`,
      appName
    );
    // @ts-expect-error
    const task = yield* fork(useIO, socket);
    yield* take(createAction("testFinished"));
    yield* put(app.actions.closeServices());
  }

  const rootTask = runSaga(root);

  return { store, runSaga, rootTask, manager };
};

const throwAssertionError = (
  action: PayloadAction<ReturnType<typeof errors.actions.addError>["payload"]>
) => {
  throw new assert.AssertionError({
    message: `Nectar received error: ${JSON.stringify(action.payload)}`,
  });
};

export function* assertNoErrors(): Generator {
  // Use at the beginning of test saga
  yield* all([takeEvery(errors.actions.addError, throwAssertionError)]);
}

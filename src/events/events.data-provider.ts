import { TypedEventEmitter } from './events.utils';
import { io, Socket } from 'socket.io-client';
import { DataEventsMap, DataMethod } from './events.types';

export class DataProvider extends TypedEventEmitter<DataEventsMap> {
  private _dataSocket: Socket | undefined;
  private _globalMessages: {
    id: string;
    method: DataMethod;
  }[] = [];
  private _logger?: (message: string) => void;

  constructor({
    logger,
    debug,
  }: {
    logger?: (message: string) => void;
    debug?: boolean;
  }) {
    super();
    if (debug) this._logger = logger || console.log;
  }

  private _emitDataMessage(method: DataMethod, params: unknown) {
    if (!this._dataSocket) {
      this._logger?.(
        '[DataProvider] Data socket not connected. Cannot send message'
      );
      return;
    }
    const uuid = self.crypto.randomUUID();
    const message = {
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: uuid,
    };
    this._globalMessages.push({ id: uuid, method });
    this._logger?.(`Emitting message: ${JSON.stringify(message)}`);
    this._dataSocket.emit('message', message);
  }

  /*//////////////////////////////////////////////////////////////
                              CONNECT
    //////////////////////////////////////////////////////////////*/

  connect(endpoint: string) {
    this._dataSocket = io(endpoint, {
      transports: ['websocket'],
    });
    this._dataSocket.on(
      'message',
      (data: { id: string; result: any; error: any }) => {
        const method = this._globalMessages.find(
          (m) => m.id === data.id
        )?.method;

        this._logger?.(
          `[DataProvider] For ${method}, received message: ${JSON.stringify(
            data
          )}`
        );

        switch (method) {
          case DataMethod.hg_getMarkets:
            this.emit(DataMethod.hg_getMarkets, data.result, data.error);
            break;
          default:
            break;
        }
      }
    );
  }

  /*//////////////////////////////////////////////////////////////
                              ACTIONS
    //////////////////////////////////////////////////////////////*/

  requestMarkets() {
    this._logger?.('[DataProvider] Requesting markets');
    this._emitDataMessage(DataMethod.hg_getMarkets, {});
  }
}

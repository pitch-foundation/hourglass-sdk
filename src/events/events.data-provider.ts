import { TypedEventEmitter } from './events.utils';
import { io, Socket } from 'socket.io-client';
import { DataEventsMap, DataMethod } from './events.types';

export class DataProvider extends TypedEventEmitter<DataEventsMap> {
  private _dataSocket: Socket | undefined;
  private _globalMessages: {
    id: string;
    method: DataMethod;
  }[] = [];

  constructor() {
    super();
  }

  private _emitDataMessage(method: DataMethod, params: unknown) {
    if (!this._dataSocket) {
      console.error('dataSocket not connected. Cannot send message');
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
    this._dataSocket.emit('message', message);
  }

  /*//////////////////////////////////////////////////////////////
                              CONNECT
    //////////////////////////////////////////////////////////////*/

  connect() {
    this._dataSocket = io('ws://localhost:3000/data', {
      transports: ['websocket'],
    });
    this._dataSocket.on(
      'message',
      (data: { id: string; result: any; error: any }) => {
        const method = this._globalMessages.find(
          (m) => m.id === data.id
        )?.method;

        switch (method) {
          case DataMethod.hg_getMarkets:
            this.emit('GetMarkets', data.result);
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
    this._emitDataMessage(DataMethod.hg_getMarkets, {});
  }
}

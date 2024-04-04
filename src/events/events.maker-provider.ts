import { TypedEventEmitter } from './events.utils';
import { io, Socket } from 'socket.io-client';
import {
  MakerMethod,
  MakerEventsMap,
  HourglassWebsocketEvent,
} from './events.types';

export class MakerProvider extends TypedEventEmitter<MakerEventsMap> {
  private _socket: Socket | undefined;
  private _globalMessages: {
    id: string;
    method: MakerMethod;
  }[] = [];

  constructor() {
    super();
  }

  private _emitMessage(method: MakerMethod, params: unknown) {
    if (!this._socket) {
      console.error('Maker socket not connected. Cannot send message');
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
    this._socket.emit('message', message);
  }

  /*//////////////////////////////////////////////////////////////
                              CONNECT
    //////////////////////////////////////////////////////////////*/

  connect({
    clientId,
    clientSecret,
    endpoint,
  }: {
    clientId: string;
    clientSecret: string;
    endpoint: string;
  }) {
    const authSocket = io(endpoint, {
      transports: ['websocket'],
      auth: {
        clientId,
        clientSecret,
      },
    });
    authSocket.on(
      HourglassWebsocketEvent.AccessToken,
      (data: { accessToken: string }, callback: (value: string) => void) => {
        callback('ACK');
        this._socket = io(endpoint, {
          transports: ['websocket'],
          auth: {
            token: data.accessToken,
          },
        });

        this._socket.on(
          'message',
          (data: { id: string; result: any; error: any }) => {
            const method = this._globalMessages.find(
              (m) => m.id === data.id
            )?.method;

            switch (method) {
              case MakerMethod.hg_submitQuote:
                this.emit(MakerMethod.hg_submitQuote, data.result, data.error);
                break;
              case MakerMethod.hg_subscribeToMarket:
                this.emit(
                  MakerMethod.hg_subscribeToMarket,
                  data.result,
                  data.error
                );
                break;
              case MakerMethod.hg_unsubscribeFromMarket:
                this.emit(
                  MakerMethod.hg_unsubscribeFromMarket,
                  data.result,
                  data.error
                );
                break;
              default:
                break;
            }
          }
        );

        this._socket.on(
          HourglassWebsocketEvent.OrderCreated,
          (data: any, callback: (value: string) => void) => {
            this.emit(HourglassWebsocketEvent.OrderCreated, data, undefined);
            callback('ACK');
          }
        );

        this._socket.on(
          HourglassWebsocketEvent.OrderFulfilled,
          (data: any, callback: (value: string) => void) => {
            this.emit(HourglassWebsocketEvent.OrderFulfilled, data, undefined);
            callback('ACK');
          }
        );
      }
    );
  }

  /*//////////////////////////////////////////////////////////////
                              ACTIONS
    //////////////////////////////////////////////////////////////*/

  submitQuote(data: { quoteAmount: string; rfqId: number }) {
    this._emitMessage(MakerMethod.hg_submitQuote, data);
  }

  subscribeToMarket(data: { marketId: number }) {
    this._emitMessage(MakerMethod.hg_subscribeToMarket, data);
  }

  unsubscribeFromMarket(data: { marketId: number }) {
    this._emitMessage(MakerMethod.hg_unsubscribeFromMarket, data);
  }
}

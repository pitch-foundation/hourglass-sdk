import { TypedEventEmitter } from './events.utils';
import { io, Socket } from 'socket.io-client';
import {
  MakerMethod,
  MakerEventsMap,
  HourglassWebsocketEvent,
} from './events.types';
import { call } from 'viem/actions';

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
    const uuid = crypto.randomUUID();
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
    allowForceDisconnect = true,
  }: {
    clientId: string;
    clientSecret: string;
    endpoint: string;
    allowForceDisconnect?: boolean;
  }) {
    const setupHandlers = async (accessToken: string) => {
      this._socket = io(endpoint, {
        transports: ['websocket'],
        auth: {
          clientId,
          clientSecret,
          token: accessToken,
          allowForceDisconnect,
        },
      });

      this._socket.on(
        'message',
        (data: { id: string; result: any; error: any }) => {
          console.log('Message received', data);

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

      this._socket.on(
        HourglassWebsocketEvent.RequestForQuoteBroadcast,
        (data: any) => {
          // This event is emitted to all market makers within a market room. Since this is emitted to a room,
          // we don't need to ACK to the server.
          this.emit(
            HourglassWebsocketEvent.RequestForQuoteBroadcast,
            data,
            undefined
          );
        }
      );
    };

    const authSocket = io(endpoint, {
      transports: ['websocket'],
      auth: {
        clientId,
        clientSecret,
        allowForceDisconnect,
      },
    });
    authSocket.on(
      HourglassWebsocketEvent.AccessToken,
      (data: { accessToken: string }, callback: (value: string) => void) => {
        console.log('Access token received', data);
        this.emit(HourglassWebsocketEvent.AccessToken, data, undefined);
        callback('ACK');
      }
    );

    this.on(
      HourglassWebsocketEvent.AccessToken,
      (data: { accessToken: string }) => {
        setupHandlers(data.accessToken);
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

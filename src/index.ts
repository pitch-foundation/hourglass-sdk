import { TypedEventEmitter } from './TypedEventEmitter';
import { io, Socket } from 'socket.io-client';
import {
  RFQMethod,
  HourglassWebsocketEvent,
  RfqType,
  DataMethod,
} from './types';
import { EventsMap } from './EventsMap';
import { SeaportOrderComponents } from './seaport.types';

export class Provider extends TypedEventEmitter<EventsMap> {
  private _rfqSocket: Socket | undefined;
  private _dataSocket: Socket | undefined;
  private _globalMessages: {
    id: string;
    method: RFQMethod | DataMethod;
  }[] = [];

  constructor() {
    super();
  }

  private _emitRFQMessage(method: RFQMethod, params: unknown) {
    if (!this._rfqSocket) {
      console.error('rfqSocket not connected. Cannot send message');
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
    this._rfqSocket.emit('message', message);
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

  connect(authSignature: string, userAddress: string) {
    // data namespace
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
            this.emit('getMarkets', data.result);
            break;
          default:
            break;
        }
      }
    );

    // rfq namespace
    const authSocket = io('ws://localhost:3000/rfq', {
      transports: ['websocket'],
      auth: {
        authSignature,
        authMessage: { address: userAddress },
      },
    });
    authSocket.on(
      HourglassWebsocketEvent.AccessToken,
      (data: { accessToken: string }, callback: (value: string) => void) => {
        callback('ACK');
        this._rfqSocket = io('ws://localhost:3000/rfq', {
          transports: ['websocket'],
          auth: {
            token: data.accessToken,
          },
        });

        this._rfqSocket.on(
          'message',
          (data: { id: string; result: any; error: any }) => {
            const method = this._globalMessages.find(
              (m) => m.id === data.id
            )?.method;

            switch (method) {
              case RFQMethod.hg_requestQuote:
                this.emit('requestQuote', data.result);
                break;
              case RFQMethod.hg_acceptQuote:
                this.emit('acceptQuote', data.result);
                break;
              default:
                break;
            }
          }
        );

        this._rfqSocket.on(
          HourglassWebsocketEvent.BestQuote,
          (data: any, callback: (value: string) => void) => {
            this.emit('bestQuote', data);
            callback('ACK');
          }
        );

        this._rfqSocket.on(
          HourglassWebsocketEvent.OrderFulfilled,
          (data: any, callback: (value: string) => void) => {
            this.emit('orderFulfilled', data);
            callback('ACK');
          }
        );
      }
    );
  }

  /*//////////////////////////////////////////////////////////////
                              ACTIONS
    //////////////////////////////////////////////////////////////*/

  requestQuote(data: {
    baseAssetAddress: string;
    quoteAssetAddress: string;
    baseAmount: string;
    chainId: number;
    type: RfqType;
  }) {
    this._emitRFQMessage(RFQMethod.hg_requestQuote, data);
  }

  requestMarkets() {
    this._emitDataMessage(DataMethod.hg_getMarkets, {});
  }

  acceptQuote(data: {
    quoteId: number;
    components?: SeaportOrderComponents;
    signature?: string;
  }) {
    this._emitRFQMessage(RFQMethod.hg_acceptQuote, data);
  }
}

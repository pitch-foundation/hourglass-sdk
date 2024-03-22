import { TypedEventEmitter } from './events.utils';
import { io, Socket } from 'socket.io-client';
import {
  RFQMethod,
  HourglassWebsocketEvent,
  RFQEventsMap,
  RfqType,
} from './events.types';
import { SeaportOrderComponents } from '../seaport/seaport.types';

export class RFQProvider extends TypedEventEmitter<RFQEventsMap> {
  private _rfqSocket: Socket | undefined;
  private _globalMessages: {
    id: string;
    method: RFQMethod;
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

  /*//////////////////////////////////////////////////////////////
                              CONNECT
    //////////////////////////////////////////////////////////////*/

  connect(authSignature: string, userAddress: string) {
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
                this.emit('RequestQuote', data.result);
                break;
              case RFQMethod.hg_acceptQuote:
                this.emit('AcceptQuote', data.result);
                break;
              default:
                break;
            }
          }
        );

        this._rfqSocket.on(
          HourglassWebsocketEvent.BestQuote,
          (data: any, callback: (value: string) => void) => {
            this.emit('BestQuote', data);
            callback('ACK');
          }
        );

        this._rfqSocket.on(
          HourglassWebsocketEvent.OrderFulfilled,
          (data: any, callback: (value: string) => void) => {
            this.emit('OrderFulfilled', data);
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

  acceptQuote(data: {
    quoteId: number;
    components?: SeaportOrderComponents;
    signature?: string;
  }) {
    this._emitRFQMessage(RFQMethod.hg_acceptQuote, data);
  }
}

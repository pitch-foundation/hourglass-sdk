import { TypedEventEmitter } from './events.utils';
import { io, Socket } from 'socket.io-client';
import {
  TakerMethod,
  HourglassWebsocketEvent,
  TakerEventsMap,
  UseCase,
  OrderExecutor,
  TakerSource,
} from './events.types';
import { SeaportOrderComponents } from '../seaport/seaport.types';

export class TakerProvider extends TypedEventEmitter<TakerEventsMap> {
  private _socket: Socket | undefined;
  private _globalMessages: {
    id: string;
    method: TakerMethod;
  }[] = [];

  constructor() {
    super();
  }

  private _emitMessage(method: TakerMethod, params: unknown) {
    if (!this._socket) {
      console.error('Taker socket not connected. Cannot send message');
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
    source,
    endpoint,
    allowForceDisconnect,
  }: {
    clientId: string;
    clientSecret: string;
    source: TakerSource;
    endpoint: string;
    allowForceDisconnect?: boolean;
  }) {
    let auth: Record<string, any> = {
      source,
      allowForceDisconnect,
    };
    if (source === 'API') {
      auth = {
        ...auth,
        clientId,
        clientSecret,
      };
    } else if (source === 'HOURGLASS_PROTOCOL' || source === 'ION_PROTOCOL') {
      auth = {
        ...auth,
        secret: clientSecret,
      };
    }

    const authSocket = io(endpoint, {
      transports: ['websocket'],
      auth,
    });
    authSocket.on(
      HourglassWebsocketEvent.AccessToken,
      (data: { accessToken: string }, callback: (value: string) => void) => {
        callback('ACK');
        this._socket = io(endpoint, {
          transports: ['websocket'],
          auth: {
            ...auth,
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
              case TakerMethod.hg_requestQuote:
                this.emit(TakerMethod.hg_requestQuote, data.result, data.error);
                break;
              case TakerMethod.hg_acceptQuote:
                this.emit(TakerMethod.hg_acceptQuote, data.result, data.error);
                break;
              default:
                break;
            }
          }
        );

        this._socket.on(
          HourglassWebsocketEvent.BestQuote,
          (data: any, callback: (value: string) => void) => {
            this.emit(HourglassWebsocketEvent.BestQuote, data, undefined);
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

  requestQuote(data: {
    baseAssetAddress: string;
    quoteAssetAddress: string;
    baseAssetChainId: number;
    quoteAssetChainId: number;
    baseAmount?: string;
    quoteAmount?: string;
    quoteAssetReceiverAddress?: string;
    executor: OrderExecutor;
    useCase?: UseCase;
    useCaseMetadata?: Record<string, any>;
  }) {
    this._emitMessage(TakerMethod.hg_requestQuote, data);
  }

  acceptQuote(data: {
    quoteId: number;
    components?: SeaportOrderComponents;
    signature?: string;
  }) {
    this._emitMessage(TakerMethod.hg_acceptQuote, data);
  }
}

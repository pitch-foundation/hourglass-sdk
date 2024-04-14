import { Socket } from 'socket.io-client';
import { SeaportOrderComponents } from '../seaport/seaport.types';
import {
  ExecutorAndQuoteAssetReceiver,
  PayloadAccessToken,
  PayloadBestQuote,
  PayloadMessage,
  PayloadOrderCreated,
  PayloadOrderFulfilled,
  SocketOnCallback,
  TakerAuth,
  TakerEventsMap,
  TakerMethod,
  UseCase,
  WebsocketEvent,
} from './events.types';
import { BaseProvider, ReconnectionState } from './events.utils';

export class TakerProvider extends BaseProvider<
  TakerEventsMap,
  TakerMethod,
  TakerAuth
> {
  /*//////////////////////////////////////////////////////////////
                              CONNECT
    //////////////////////////////////////////////////////////////*/

  setupListeners(socket: Socket, rs: ReconnectionState) {
    socket.on(
      WebsocketEvent.AccessToken,
      (data: PayloadAccessToken, callback: SocketOnCallback) => {
        this.log(`Received access token: ${data.accessToken}`);
        rs.setAccessToken(data.accessToken);
        this.emit(WebsocketEvent.AccessToken, data, undefined);
        callback('ACK');
      }
    );

    socket.on(
      WebsocketEvent.BestQuote,
      (data: PayloadBestQuote, callback: SocketOnCallback) => {
        this.log(`Received best quote: ${JSON.stringify(data)}`);
        this.emit(WebsocketEvent.BestQuote, data, undefined);
        callback('ACK');
      }
    );

    socket.on(
      WebsocketEvent.OrderFulfilled,
      (data: PayloadOrderFulfilled, callback: SocketOnCallback) => {
        this.log(`Received order fulfilled: ${JSON.stringify(data)}`);
        this.emit(WebsocketEvent.OrderFulfilled, data, undefined);
        callback('ACK');
      }
    );

    socket.on(
      WebsocketEvent.OrderCreated,
      (data: PayloadOrderCreated, callback: SocketOnCallback) => {
        this.log(`Received order created: ${JSON.stringify(data)}`);
        this.emit(WebsocketEvent.OrderCreated, data, undefined);
        callback('ACK');
      }
    );

    socket.on('message', (data: PayloadMessage) => {
      const msg = this.findMessage(data.id);
      if (!msg) return;
      if (Object.values(TakerMethod).includes(msg.method)) {
        this.emit(msg.method, data.result, data.error);
      } else {
        this.log(`Found incoming message but method unknown: ${msg.method}`);
      }
    });
  }

  connect({ auth, endpoint }: { auth: TakerAuth; endpoint: string }) {
    super.connectEntrypoint({ endpoint, auth });
  }

  /*//////////////////////////////////////////////////////////////
                              ACTIONS
    //////////////////////////////////////////////////////////////*/

  requestQuote(
    data: {
      baseAssetAddress: string;
      quoteAssetAddress: string;
      baseAssetChainId: number;
      quoteAssetChainId: number;
      baseAmount?: string;
      quoteAmount?: string;
      useCase?: UseCase;
      useCaseMetadata?: Record<string, any>;
    } & ExecutorAndQuoteAssetReceiver
  ) {
    if (
      (data.baseAmount && data.quoteAmount) ||
      (!data.baseAmount && !data.quoteAmount)
    ) {
      throw new Error('Must specify either baseAmount XOR quoteAmount.');
    }
    this.log(`Requesting quote: ${JSON.stringify(data)}`);
    this.emitMessage(TakerMethod.hg_requestQuote, data);
  }

  acceptQuote(data: {
    quoteId: number;
    components?: SeaportOrderComponents;
    signature?: string;
  }) {
    this.log(`Accepting quote: ${JSON.stringify(data)}`);
    this.emitMessage(TakerMethod.hg_acceptQuote, data);
  }
}

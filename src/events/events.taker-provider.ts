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
import { BaseProvider } from './events.utils';

export class TakerProvider extends BaseProvider<
  TakerEventsMap,
  TakerMethod,
  TakerAuth
> {
  /*//////////////////////////////////////////////////////////////
                              CONNECT
    //////////////////////////////////////////////////////////////*/

  connect({ auth, endpoint }: { auth: TakerAuth; endpoint: string }) {
    const rs = super.connectEntrypoint(endpoint, auth);
    if (!this.socket) {
      return;
    }

    this.socket.on(
      WebsocketEvent.AccessToken,
      (data: PayloadAccessToken, callback: SocketOnCallback) => {
        callback('ACK');
        this.log(`Received access token: ${data.accessToken}`);
        rs.setAccessToken(data.accessToken);
        this.emit(WebsocketEvent.AccessToken, data, undefined);
      }
    );

    this.socket.on(
      WebsocketEvent.BestQuote,
      (data: PayloadBestQuote, callback: SocketOnCallback) => {
        this.log(`Received best quote: ${JSON.stringify(data)}`);
        this.emit(WebsocketEvent.BestQuote, data, undefined);
        callback('ACK');
      }
    );

    this.socket.on(
      WebsocketEvent.OrderFulfilled,
      (data: PayloadOrderFulfilled, callback: SocketOnCallback) => {
        this.log(`Received order fulfilled: ${JSON.stringify(data)}`);
        this.emit(WebsocketEvent.OrderFulfilled, data, undefined);
        callback('ACK');
      }
    );

    this.socket.on(
      WebsocketEvent.OrderCreated,
      (data: PayloadOrderCreated, callback: SocketOnCallback) => {
        this.log(`Received order created: ${JSON.stringify(data)}`);
        this.emit(WebsocketEvent.OrderCreated, data, undefined);
        callback('ACK');
      }
    );

    this.socket.on('message', (data: PayloadMessage) => {
      const msg = this.findMessage(data.id);
      if (!msg) return;

      const { result, error } = data;
      switch (msg?.method) {
        case TakerMethod.hg_requestQuote:
          this.emit(TakerMethod.hg_requestQuote, result, error);
          break;
        case TakerMethod.hg_acceptQuote:
          this.emit(TakerMethod.hg_acceptQuote, result, error);
          break;
        default:
          break;
      }
    });
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

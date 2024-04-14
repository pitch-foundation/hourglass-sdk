import {
  MakerAuth,
  MakerEventsMap,
  MakerMethod,
  PayloadAccessToken,
  PayloadMessage,
  PayloadOrderCreated,
  PayloadOrderFulfilled,
  PayloadQuoteAccepted,
  PayloadRequestForQuoteBroadcast,
  SocketOnCallback,
  WebsocketEvent,
} from './events.types';
import { BaseProvider } from './events.utils';

export class MakerProvider extends BaseProvider<
  MakerEventsMap,
  MakerMethod,
  MakerAuth
> {
  /*//////////////////////////////////////////////////////////////
                              CONNECT
    //////////////////////////////////////////////////////////////*/

  connect({ auth, endpoint }: { auth: MakerAuth; endpoint: string }) {
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
      WebsocketEvent.OrderCreated,
      (data: PayloadOrderCreated, callback: SocketOnCallback) => {
        callback('ACK');
        this.log(`Received order created: ${JSON.stringify(data)}`);
        this.emit(WebsocketEvent.OrderCreated, data, undefined);
      }
    );

    this.socket.on(
      WebsocketEvent.OrderFulfilled,
      (data: PayloadOrderFulfilled, callback: SocketOnCallback) => {
        callback('ACK');
        this.log(`Received order fulfilled: ${JSON.stringify(data)}`);
        this.emit(WebsocketEvent.OrderFulfilled, data, undefined);
      }
    );

    this.socket.on(
      WebsocketEvent.QuoteAccepted,
      (data: PayloadQuoteAccepted, callback: SocketOnCallback) => {
        callback('ACK');
        this.log(`Received quote accepted: ${JSON.stringify(data)}`);
        this.emit(WebsocketEvent.QuoteAccepted, data, undefined);
      }
    );

    this.socket.on(
      WebsocketEvent.RequestForQuoteBroadcast,
      (data: PayloadRequestForQuoteBroadcast) => {
        // This event is emitted to all market makers within a market room. Since this is emitted to a room,
        // we don't need to ACK to the server.
        this.log(
          `Received request for quote broadcast: ${JSON.stringify(data)}`
        );
        this.emit(WebsocketEvent.RequestForQuoteBroadcast, data, undefined);
      }
    );

    this.socket.on('message', (data: PayloadMessage) => {
      const msg = this.findMessage(data.id);
      if (!msg) return;

      const { result, error } = data;
      switch (msg?.method) {
        case MakerMethod.hg_submitQuote:
          this.emit(MakerMethod.hg_submitQuote, result, error);
          break;
        case MakerMethod.hg_subscribeToMarket:
          this.emit(MakerMethod.hg_subscribeToMarket, result, error);
          break;
        case MakerMethod.hg_unsubscribeFromMarket:
          this.emit(MakerMethod.hg_unsubscribeFromMarket, result, error);
          break;
        default:
          break;
      }
    });
  }

  /*//////////////////////////////////////////////////////////////
                              ACTIONS
    //////////////////////////////////////////////////////////////*/

  submitQuote(data: {
    baseAmount?: string;
    quoteAmount?: string;
    rfqId: number;
  }) {
    if (
      (data.baseAmount && data.quoteAmount) ||
      (!data.baseAmount && !data.quoteAmount)
    ) {
      throw new Error('Must specify either baseAmount XOR quoteAmount.');
    }
    this.log(`Submitting quote: ${JSON.stringify(data)}`);
    this.emitMessage(MakerMethod.hg_submitQuote, data);
  }

  subscribeToMarket(data: { marketId: number }) {
    this.log(`Subscribing to market: ${JSON.stringify(data)}`);
    this.emitMessage(MakerMethod.hg_subscribeToMarket, data);
  }

  unsubscribeFromMarket(data: { marketId: number }) {
    this.log(`Unsubscribing from market: ${JSON.stringify(data)}`);
    this.emitMessage(MakerMethod.hg_unsubscribeFromMarket, data);
  }
}

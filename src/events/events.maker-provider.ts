import { Socket } from 'socket.io-client';
import {
  MakerAuth,
  MakerEventsMap,
  MakerMethod,
  PayloadAccessToken,
  PayloadMessage,
  PayloadOrderCreated,
  PayloadOrderFulfilled,
  PayloadQuoteAccepted,
  QuoteAcceptedCallbackArgs,
  PayloadRequestForQuoteBroadcast,
  SocketOnCallback,
  WebsocketEvent,
} from './events.types.js';
import { BaseProvider, ReconnectionState } from './events.utils.js';

export class MakerProvider extends BaseProvider<
  MakerEventsMap,
  MakerMethod,
  MakerAuth
> {
  /*//////////////////////////////////////////////////////////////
                              CONNECT
    //////////////////////////////////////////////////////////////*/

  protected setupListeners(socket: Socket, rs: ReconnectionState) {
    socket.on(
      WebsocketEvent.AccessToken,
      (data: PayloadAccessToken, callback: SocketOnCallback) => {
        callback('ACK');
        this.log(`Received access token: ${data.accessToken}`);
        rs.setAccessToken(data.accessToken);
        this.emit(WebsocketEvent.AccessToken, data, undefined);
      }
    );

    socket.on(
      WebsocketEvent.OrderCreated,
      (data: PayloadOrderCreated, callback: SocketOnCallback) => {
        callback('ACK');
        this.log(`Received order created: ${JSON.stringify(data)}`);
        this.emit(WebsocketEvent.OrderCreated, data, undefined);
      }
    );

    socket.on(
      WebsocketEvent.OrderFulfilled,
      (data: PayloadOrderFulfilled, callback: SocketOnCallback) => {
        callback('ACK');
        this.log(`Received order fulfilled: ${JSON.stringify(data)}`);
        this.emit(WebsocketEvent.OrderFulfilled, data, undefined);
      }
    );

    socket.on(
      WebsocketEvent.QuoteAccepted,
      (
        data: PayloadQuoteAccepted,
        callback: (data: QuoteAcceptedCallbackArgs) => void
      ) => {
        this.log(`Received quote accepted: ${JSON.stringify(data)}`);
        this.emit(WebsocketEvent.QuoteAccepted, data, undefined, callback);
      }
    );

    socket.on(
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

    socket.on('message', (data: PayloadMessage) => {
      const msg = this.findMessage(data.id);
      if (!msg) return;
      if (Object.values(MakerMethod).includes(msg.method)) {
        this.emit(msg.method, data.result, data.error);
      } else {
        this.log(`Found incoming message but method unknown: ${msg.method}`);
      }
    });
  }

  /**
   * Connect to the websocket server. For resuming a connection, add the
   * optional `token` to the `auth` object.
   */
  connect({ auth, endpoint }: { auth: MakerAuth; endpoint: string }) {
    super.connectEntrypoint({ endpoint, auth });
  }

  /*//////////////////////////////////////////////////////////////
                              ACTIONS
    //////////////////////////////////////////////////////////////*/

  /**
   * Submit a quote to the server. Listen for the `MakerMethod.hg_submitQuote`
   * event to get the confirmation.
   */
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

  /**
   * Subscribe to a market. Listen for the `MakerMethod.hg_subscribeToMarket`
   * event to get the confirmation.
   */
  subscribeToMarket(data: { marketId: number }) {
    this.log(`Subscribing to market: ${JSON.stringify(data)}`);
    this.emitMessage(MakerMethod.hg_subscribeToMarket, data);
  }

  /**
   * Unsubscribe from a market. Listen for the `MakerMethod.hg_unsubscribeFromMarket`
   * event to get the confirmation.
   */
  unsubscribeFromMarket(data: { marketId: number }) {
    this.log(`Unsubscribing from market: ${JSON.stringify(data)}`);
    this.emitMessage(MakerMethod.hg_unsubscribeFromMarket, data);
  }
}

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
  PayloadHgSubscribeToMarket,
  PayloadHgSubmitQuote,
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
      switch (msg.method) {
        case MakerMethod.hg_subscribeToMarket:
          this.emit(
            msg.method,
            data.result as PayloadHgSubscribeToMarket | undefined,
            data.error
          );
          break;
        case MakerMethod.hg_unsubscribeFromMarket:
          this.emit(
            msg.method,
            data.result as PayloadHgSubscribeToMarket | undefined,
            data.error
          );
          break;
        case MakerMethod.hg_submitQuote:
          this.emit(
            msg.method,
            data.result as PayloadHgSubmitQuote | undefined,
            data.error
          );
          break;
        default: {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const _exhaustiveCheck: never = msg.method;
          this.log(`Found incoming message but method unknown: ${msg.method}`);
        }
      }
    });
  }

  /**
   * Establishes a connection to the websocket server.
   *
   * @param {Object} params - Connection options.
   * @param {MakerAuth} params.auth - The authentication object.
   * @param {string} [params.auth.accessToken] - The access token. If provided, allows the user to skip
   *    authentication and resume interactions from previous sessions. If not provided, a new access token
   *    will be issued to the user upon a successful authentication.
   * @param {boolean} [params.allowForceDisconnect] - Allow the provider to force disconnect the socket.
   *    The system enforces a constraint that only a single connection can exist for a given `accessToken`.
   *    Assuming there is an existing connection with an access token
   *    - If flag is true -> existing socket disconnected and new socket established with the same access token.
   *    - If flag is false -> existing socket remains connected and connection error is thrown.
   * @param {string} params.auth.clientId - The client ID for a maker API user.
   * @param {string} params.auth.clientSecret - The client secret for a maker API user.
   * @param {string} params.endpoint - The endpoint to connect to.
   *
   * @example
   * ```typescript
   * connect({ endpoint: 'ws://localhost:3100/maker' });
   * ```
   */
  connect({ auth, endpoint }: { auth: MakerAuth; endpoint: string }) {
    super.connectEntrypoint({ endpoint, auth });
  }

  /*//////////////////////////////////////////////////////////////
                              ACTIONS
    //////////////////////////////////////////////////////////////*/

  /**
   * Submit a quote for an RFQ.
   *
   * This method triggers the emission of a 'message' event to the server.
   * The listener for the `DataMethod.hg_submitQuote` will receive the response.
   * - If successful, the type of the response object will be `PayloadHgGetMarkets`.
   *
   * An RFQ can either have the base amount or quote amount specified. When submitting a quote for an RFQ,
   * the market maker must specify the opposite asset (i.e. if RFQ specifies base amount, the market maker must submit
   * the quote amount with the quote and vice versa).
   *
   * @param {Object} data - The quote data.
   * @param {string} [data.baseAmount] - The base amount of the quote. If specified, quoteAmount must not be specified.
   * @param {string} [data.quoteAmount] - The quote amount of the quote. If specified, baseAmount must not be specified.
   * @param {number} data.rfqId - The RFQ ID.
   *
   * @example
   * ```typescript
   *  makerProvider.submitQuote();
   *  makerProvider.on(MakerMethod.hg_submitQuote, (data: PayloadHgSubmitQuote, err) => {
   *    // Check for error and handle response if successful
   *  });
   * ```
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
   * Subscribe to a market.
   *
   * This method triggers the emission of a 'message' event to the server.
   * The listener for the `MakerMethod.hg_subscribeToMarket` will receive the confirmation.
   *
   * @param {Object} data - The subscription data.
   * @param {number} data.marketId - The ID of the market to subscribe to.
   *
   * @example
   * ```typescript
   *  makerProvider.subscribeToMarket({ marketId: 1 });
   *  makerProvider.on(MakerMethod.hg_subscribeToMarket, (data, err) => {
   *    // Check for error and handle response if successful
   *  });
   * ```
   */
  subscribeToMarket(data: { marketId: number }) {
    this.log(`Subscribing to market: ${JSON.stringify(data)}`);
    this.emitMessage(MakerMethod.hg_subscribeToMarket, data);
  }

  /**
   * Unsubscribe from a market.
   *
   * This method triggers the emission of a 'message' event to the server.
   * The listener for the `MakerMethod.hg_unsubscribeFromMarket` will receive the confirmation.
   *
   * @param {Object} data - The unsubscription data.
   * @param {number} data.marketId - The ID of the market to unsubscribe from.
   *
   * @example
   * ```typescript
   *  makerProvider.unsubscribeFromMarket({ marketId: 1 });
   *  makerProvider.on(MakerMethod.hg_unsubscribeFromMarket, (data, err) => {
   *    // Check for error and handle response if successful
   *  });
   * ```
   */
  unsubscribeFromMarket(data: { marketId: number }) {
    this.log(`Unsubscribing from market: ${JSON.stringify(data)}`);
    this.emitMessage(MakerMethod.hg_unsubscribeFromMarket, data);
  }
}

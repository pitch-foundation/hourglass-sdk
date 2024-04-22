import { Socket } from 'socket.io-client';
import {
  AuthMakerUser,
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
  PayloadHgUnsubscribeFromMarket,
} from '../providers.types.js';
import { BaseProvider, ReconnectionState } from '../providers.utils.js';

/**
 * @property {AuthMakerUser} auth - The authentication object.
 * @property {string} serverUrl - The base url of the server to connect to.
 * @interface
 */
export interface MakerConnectArgs {
  auth: AuthMakerUser;
  serverUrl: string;
}

/** Input arguments for {@link MakerProvider.submitQuote}.
 *
 * @property {string} [baseAmount] - The base amount a market maker quotes for an RFQ. If specified, quoteAmount must not be specified.
 * @property {string} [quoteAmount] - The quote amount a market maker quotes for an RFQ. If specified, baseAmount must not be specified.
 * @property {number} rfqId - The RFQ ID to submit a quote for.
 * @interface
 */
export interface MakerProviderSubmitQuoteArgs {
  baseAmount?: string;
  quoteAmount?: string;
  rfqId: number;
}

/** Input arguments for {@link MakerProvider.subscribeToMarket}.
 *
 * @property {number} marketId - The ID of the market to subscribe to.
 * @interface
 */
export interface MakerProviderSubscribeToMarketArgs {
  marketId: number;
}

/** Input arguments for {@link MakerProvider.unsubscribeFromMarket}.
 *
 * @property {number} marketId - The ID of the market to unsubscribe from.
 * @interface
 */
export interface MakerProviderUnsubscribeFromMarketArgs {
  marketId: number;
}

/**
 * The `MakerProvider` facilitates interactions with the Hourglass RFQ system `/maker` namespace.
 *
 * The `/maker` namespaces enables clients to act as market makers on the platform.
 * The current set of supported actions is:
 * - Submit quotes for RFQs (see {@link MakerProvider.submitQuote})
 * - Subscribe to markets (see {@link MakerProvider.subscribeToMarket})
 * - Unsubscribe from markets (see {@link MakerProvider.unsubscribeFromMarket})
 *
 * This class extends an event emitter and proxies events from the underlying websocket to
 * itself so that SDK consumers can listen for events without managing the websocket.
 *
 * @example
 * ```typescript
 * const makerProvider = new MakerProvider();
 * ```
 */
export class MakerProvider extends BaseProvider<
  MakerEventsMap,
  MakerMethod,
  AuthMakerUser
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
            data.result as PayloadHgUnsubscribeFromMarket | undefined,
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
   * Establishes a connection to the websocket server for the `/maker` namespace.
   *
   * @param {MakerConnectArgs} params - Connection options.
   *
   * @example
   * ```typescript
   * import { SERVER_URL_STAGING } from '@hourglass/sdk';
   *
   * makerProvider.connect({ serverUrl: SERVER_URL_STAGING });
   * makerProvider.on('connect', () => {
   *  console.log("Successfully connected to the server");
   * })
   * makerProvider.on('connect_error', (error) => {
   *  console.error(`Failed to connect to the server: ${error.message}`);
   * })
   * makerProvider.on('disconnect', (reason, description) => {
   *  console.log(`Disconnected from the server: ${reason}`);
   * })
   * makerProvider.on(WebsocketEvent.AccessToken, (data: PayloadAccessToken) => {
   *  // logic to store access token for future use.
   * })
   * ```
   * @category Connect
   */
  connect({ auth, serverUrl }: MakerConnectArgs) {
    super.connectEntrypoint({
      endpoint: new URL('maker', serverUrl).toString(),
      auth,
    });
  }

  /*//////////////////////////////////////////////////////////////
                              ACTIONS
    //////////////////////////////////////////////////////////////*/

  /**
   * Submit a quote for an RFQ.
   *
   * - This method triggers the emission of a 'message' event to the server.
   * - The listener for the {@link MakerMethod.hg_submitQuote} will receive the response.
   * - If successful, the type of the response object will be {@link PayloadHgSubmitQuote}.
   *
   * When a taker creates an RFQ, they will specify the base amount or quote amount. The market maker
   * submitting a quote for an RFQ must specify the opposite asset (i.e. if RFQ specifies base amount,
   * the market maker must specify the quote amount and vice versa).
   *
   * @param {MakerProviderSubmitQuoteArgs} args - Input args.
   *
   * @example
   * ```typescript
   *  // rfq1.quoteAmount is specified
   *  makerProvider.submitQuote({
   *    baseAmount: '1000000000000000000', // 1 ether in wei
   *    rfqId: 1,
   *  });
   *  // rfq2.baseAmount is specified
   *  makerProvider.submitQuote({
   *    quoteAmount: '1000000000000000000', // 1 ether in wei
   *    rfqId: 2,
   *  });
   *  makerProvider.on(MakerMethod.hg_submitQuote, (data: PayloadHgSubmitQuote, error) => {
   *    if (error) {
   *      console.error(`Error submitting quote: ${error}`);
   *      return;
   *    }
   *    console.log(`Successfully submitted quote: ${data}`);
   *  });
   * ```
   * @category Actions
   */
  submitQuote(args: MakerProviderSubmitQuoteArgs) {
    if (
      (args.baseAmount && args.quoteAmount) ||
      (!args.baseAmount && !args.quoteAmount)
    ) {
      throw new Error('Must specify either baseAmount XOR quoteAmount.');
    }
    this.log(`Submitting quote: ${JSON.stringify(args)}`);
    this.emitMessage(MakerMethod.hg_submitQuote, args);
  }

  /**
   * Subscribe to a market.
   *
   * - This method triggers the emission of a 'message' event to the server.
   * - The listener for the {@link MakerMethod.hg_subscribeToMarket} will receive the confirmation.
   * - If successful, the type of the response object will be {@link PayloadHgSubscribeToMarket}.
   *
   * When a maker subscribes to a market, it creates a subscription in the database for that market
   * the links together a market and the maker's client id (not the specific socket). Upon connecting
   * to the server, the server checks if the client has any subscriptions and for each one, adds the client
   * into a group that will be broadcast RFQ's for the subscribed market.
   *
   * @param {MakerProviderSubscribeToMarketArgs} args - Input args.
   *
   * @example
   * ```typescript
   *  makerProvider.subscribeToMarket({ marketId: 1 });
   *  makerProvider.on(MakerMethod.hg_subscribeToMarket, (data: PayloadHgSubscribeToMarket, error) => {
   *    if (error) {
   *      console.error(`Error subscribing to market: ${error}`);
   *      return;
   *    }
   *    console.log(`Successfully subscribed to market ${data}`}`)
   *  });
   * ```
   * @category Actions
   */
  subscribeToMarket(args: MakerProviderSubscribeToMarketArgs) {
    this.log(`Subscribing to market: ${JSON.stringify(args)}`);
    this.emitMessage(MakerMethod.hg_subscribeToMarket, args);
  }

  /**
   * Unsubscribe from a market.
   *
   * - This method triggers the emission of a 'message' event to the server.
   * - The listener for the {@link MakerMethod.hg_unsubscribeFromMarket} will receive the confirmation.
   * - If successful, the type of the response object will be {@link PayloadHgUnsubscribeFromMarket}.
   *
   * When a maker unsubscribes from a market, it removes the client subscription from the database.
   * - All existing connected sockets for the maker will no longer receive RFQ's for that market.
   * - All future connected sockets for the maker will not receive RFQ's for that market.
   *
   * @param {MakerProviderUnsubscribeFromMarketArgs} args - Input args.
   *
   * @example
   * ```typescript
   *  makerProvider.unsubscribeFromMarket({ marketId: 1 });
   *  makerProvider.on(MakerMethod.hg_unsubscribeFromMarket, (data: PayloadHgUnsubscribeFromMarket, error) => {
   *    if (error) {
   *      console.error(`Error unsubscribing from market: ${error}`);
   *      return;
   *    }
   *    console.log(`Successfully unsubscribed from market ${data}`);
   *  });
   * ```
   * @category Actions
   */
  unsubscribeFromMarket(args: MakerProviderUnsubscribeFromMarketArgs) {
    this.log(`Unsubscribing from market: ${JSON.stringify(args)}`);
    this.emitMessage(MakerMethod.hg_unsubscribeFromMarket, args);
  }
}

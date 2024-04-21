import { Socket } from 'socket.io-client';
import { SeaportOrderComponents } from '../seaport/seaport.types.js';
import {
  ExecutorAndQuoteAssetReceiver,
  PayloadAccessToken,
  PayloadBestQuote,
  PayloadMessage,
  PayloadOrderCreated,
  PayloadOrderFulfilled,
  SocketOnCallback,
  AuthTakerApiUser,
  TakerEventsMap,
  UseCase,
  TakerMethod,
  WebsocketEvent,
  PayloadHgRequestQuote,
  PayloadHgAcceptQuote,
} from './providers.types.js';
import { BaseProvider, ReconnectionState } from './providers.utils.js';

/**
 * @property {AuthTakerApiUser} auth - The authentication object.
 * @property {string} serverUrl - The url of the server to connect to.
 * @interface
 */
export interface TakerConnectArgs {
  auth: AuthTakerApiUser;
  serverUrl: string;
}

export class TakerProvider extends BaseProvider<
  TakerEventsMap,
  TakerMethod,
  AuthTakerApiUser
> {
  /*//////////////////////////////////////////////////////////////
                              CONNECT
    //////////////////////////////////////////////////////////////*/

  protected setupListeners(socket: Socket, rs: ReconnectionState) {
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
      switch (msg.method) {
        case TakerMethod.hg_requestQuote:
          this.emit(
            TakerMethod.hg_requestQuote,
            data.result as PayloadHgRequestQuote | undefined,
            data.error
          );
          break;
        case TakerMethod.hg_acceptQuote:
          this.emit(
            TakerMethod.hg_acceptQuote,
            data.result as PayloadHgAcceptQuote | undefined,
            data.error
          );
          break;
        default: {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const _exhaustiveCheck: never = msg.method;
          this.log(`Found incoming message but method unknown: ${msg.method}`);
        }
      }

      if (Object.values(TakerMethod).includes(msg.method)) {
        this.emit(msg.method, data.result, data.error);
      } else {
        this.log(`Found incoming message but method unknown: ${msg.method}`);
      }
    });
  }

  /**
   * Establishes a connection to the websocket server for namespace /taker
   *
   * @param {TakerConnectArgs} params - Connection options.
   *
   * @example
   * ```typescript
   * import { SERVER_URL_STAGING } from '@hourglass/sdk';
   *
   * takerProvider.connect({ serverUrl: SERVER_URL_STAGING });
   * takerProvider.on('connect', () => {
   *  console.log("Successfully connected to the server");
   * })
   * takerProvider.on('connect_error', () => {
   *  console.log("Failed to connect to the server");
   * })
   * takerProvider.on('disconnect', () => {
   *  console.log("Disconnected from the server");
   * })
   * takerProvider.on('disconnect', () => {
   *  console.log("Disconnected from the server");
   * })
   * takerProvider.on(WebsocketEvent.AccessToken, (data: PayloadAccessToken) => {
   *  // logic to store access token for future use.
   *  // If operating in a browser, persistent storage (i.e. localStorage) can be used
   *  // so that sessions can be resumed across page reloads.
   * })
   * ```
   * @category Connect
   */
  connect({ auth, serverUrl }: TakerConnectArgs) {
    super.connectEntrypoint({
      endpoint: new URL('taker', serverUrl).toString(),
      auth,
    });
  }

  /*//////////////////////////////////////////////////////////////
                              ACTIONS
    //////////////////////////////////////////////////////////////*/

  /**
   * Request a quote from the server. Doesn't return the quote.
   * Listen for the {@link TakerMethod.hg_requestQuote} event to get the quotes.
   * - If successful, the type of the response object will be {@link PayloadHgRequestQuote}.
   *
   * @param {Object} data - The quote request data.
   * @param {string} data.baseAssetAddress - The base asset address.
   * @param {string} data.quoteAssetAddress - The quote asset address.
   * @param {number} data.baseAssetChainId - The base asset chain ID. Currently only ethereum (chainId: 1) is supported.
   * @param {number} data.quoteAssetChainId - The quote asset chain ID. Currently only ethereum (chainId: 1) is supported.
   * @param {string} [data.baseAmount] - The base amount of the quote. If specified, quoteAmount must not be specified.
   * @param {string} [data.quoteAmount] - The quote amount of the quote. If specified, baseAmount must not be specified.
   * @param {UseCase} [data.useCase] - The use case. Defaults to DEFAULT
   * @param {Record<string, any>} [data.useCaseMetadata] - The use case metadata.
   *
   * @example
   * ```typescript
   *  takerProvider.requestQuote();
   *  takerProvider.on(TakerMethod.hg_requestQuote, (data: PayloadBestQuote, err) => {
   *    // Check for error and handle response if successful
   *  });
   * ```
   * @category Actions
   */
  requestQuote(
    data: {
      baseAssetAddress: string;
      quoteAssetAddress: string;
      baseAssetChainId: number;
      quoteAssetChainId: number;
      baseAmount?: string;
      quoteAmount?: string;
      useCase?: UseCase;
      useCaseMetadata?: Record<string, unknown>;
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

  /**
   * Accept a quote from the server. Doesn't return the order.
   * Listen for the {@link TakerMethod.hg_acceptQuote} event to get the confirmation.
   * - If successful, the type of the response object will be {@link PayloadHgAcceptQuote}.
   *
   * @param {Object} data - The quote acceptance data.
   * @param {number} data.quoteId - The quote ID.
   * @param {SeaportOrderComponents} [data.components] - The seaport order components.
   * @param {string} [data.signature] - The signature.
   *
   * @example
   * ```typescript
   *  takerProvider.acceptQuote();
   *  takerProvider.on(TakerMethod.hg_acceptQuote, (data: PayloadHgAcceptQuote, err) => {
   *    // Check for error and handle response if successful
   *  });
   * ```
   * @category Actions
   */
  acceptQuote(data: {
    quoteId: number;
    components?: SeaportOrderComponents;
    signature?: string;
  }) {
    this.log(`Accepting quote: ${JSON.stringify(data)}`);
    this.emitMessage(TakerMethod.hg_acceptQuote, data);
  }
}

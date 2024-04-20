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
  TakerAuth,
  TakerEventsMap,
  UseCase,
  TakerMethod,
  WebsocketEvent,
  PayloadHgRequestQuote,
  PayloadHgAcceptQuote,
} from './events.types.js';
import { BaseProvider, ReconnectionState } from './events.utils.js';

export class TakerProvider extends BaseProvider<
  TakerEventsMap,
  TakerMethod,
  TakerAuth
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
   * Establishes a connection to the websocket server.
   *
   * @param {Object} params - Connection options.
   * @param {TakerAuth} params.auth - The authentication object.
   * @param {string} [params.auth.accessToken] - The access token. If provided, allows the user to skip
   *    authentication and resume interactions from previous sessions. If not provided, a new access token
   *    will be issued to the user upon a successful authentication.
   * @param {string} params.auth.clientId - The client ID for a taker API user.
   * @param {string} params.auth.clientSecret - The client secret for a taker API user.
   * @param {string} params.endpoint - The endpoint to connect to.
   *
   * @example
   * ```typescript
   * connect({ endpoint: 'ws://localhost:3100/taker' });
   * ```
   */
  connect({ auth, endpoint }: { auth: TakerAuth; endpoint: string }) {
    super.connectEntrypoint({ endpoint, auth });
  }

  /*//////////////////////////////////////////////////////////////
                              ACTIONS
    //////////////////////////////////////////////////////////////*/

  /**
   * Request a quote from the server. Doesn't return the quote.
   * Listen for the `TakerMethod.hg_requestQuote` event to get the quotes.
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
   * Listen for the `TakerMethod.hg_acceptQuote` event to get the confirmation.
   *
   * @param {Object} data - The quote acceptance data.
   * @param {number} data.quoteId - The quote ID.
   * @param {SeaportOrderComponents} [data.components] - The seaport order components.
   * @param {string} [data.signature] - The signature.
   *
   * @example
   * ```typescript
   *  takerProvider.acceptQuote();
   *  takerProvider.on(TakerMethod.hg_acceptQuote, (data: PayloadOrderCreated, err) => {
   *    // Check for error and handle response if successful
   *  });
   * ```
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

import { Socket } from 'socket.io-client';
import { SeaportOrderComponents } from '../../seaport/seaport.types.js';
import {
  PayloadAccessToken,
  PayloadBestQuote,
  PayloadMessage,
  PayloadOrderCreated,
  PayloadOrderFulfilled,
  SocketOnCallback,
  AuthTakerUser,
  TakerEventsMap,
  UseCase,
  TakerMethod,
  WebsocketEvent,
  PayloadHgRequestQuote,
  PayloadHgAcceptQuote,
  Market,
  OrderExecutor,
} from '../providers.types.js';
import { BaseProvider, ReconnectionState } from '../providers.utils.js';

/** Input arguments for {@link TakerProvider.connect}.
 *
 * @property {AuthTakerUser} auth - The authentication object.
 * @property {string} serverUrl - The base url of the server to connect to.
 * @interface
 */
export interface TakerProviderConnectArgs {
  auth: AuthTakerUser;
  serverUrl: string;
}

/**  Input arguments for {@link TakerProvider.requestQuote}.
 *
 * @property {string} baseAssetAddress - The base asset address. The base asset is the asset that the taker is **selling**.
 * @property {string} quoteAssetAddress - The quote asset address. The quote asset is the asset that the taker is **buying**.
 * @property {number} baseAssetChainId - The base asset chain ID. Currently only ethereum (id: 1) is supported.
 * @property {number} quoteAssetChainId - The quote asset chain ID. Currently only ethereum (id: 1) is supported.
 * @property {string} executor - The executor of the order. The RFQ system supports allowing both the maker or the taker
 * to execute orders (executor calls `seaport.fulfillOrder` or some wrapper around this function, depending on the
 * use case). Here is an overview of how the `executor` impacts the RFQ lifecycle:
 *
 * - When the executor is OrderExecutor.TAKER
 *    - The maker will be sent an order payload to sign as part of the payload for a {@link WebsocketEvent.QuoteAccepted} event.
 *    They should sign the data and send it back to the server using the ACK callback provided in the event.
 *    - The taker will receive the signed order as a part of the payload for an {@link WebsocketEvent.OrderCreated} event. At this
 *    point, the taker is free to pass the data as input to `seaport.fulfillOrder` to execute the order.
 * - When the executor is OrderExecutor.MAKER
 *    - Each time the taker receives a new {@link WebsocketEvent.BestQuote} event for a given RFQ, this event will contain the order
 *    payload to sign if they want to accept the quote. If the taker deems the quote desirable, they should sign the order and pass it
 *    as input to {@link TakerProvider.acceptQuote}.
 *    - The maker will receive the signed order as a part of the payload for an {@link WebsocketEvent.OrderCreated} event. At this point,
 *    the maker is free to pass the data as input to `seaport.fulfillOrder` to execute the order.
 *
 * Regardless of the executor, the system will notify both maker and taker of order fulfillment via a {@link WebsocketEvent.OrderFulfilled} event.
 *
 * Additionally, the `useCase` input argument constrains allowable values for this argument. TODO: more details here.
 * @property {string} [quoteAssetReceiver] - The address that will receive the quote asset.
 *  - If executor = {@link OrderExecutor.TAKER}, this should not be specified.
 *  - If executor = {@link OrderExecutor.MAKER}, this should be specified.
 *
 * For api users, the quote asset receiver must be one of their whitelisted addresses.
 * @property {string} [baseAmount] - The amount of the base asset the taker is selling. If specified, `quoteAmount` must not be specified.
 *
 * When a taker specifies `baseAmount` in their RFQ, their RFQ can be interpreted in the following way:
 *
 * *"I want to sell `baseAmount` of the base asset for the quote asset. What amount of the quote asset will I receive in return?"*
 * @property {string} [quoteAmount] - The amount of the quote asset the taker is buying. If specified, `baseAmount` must not be specified.
 *
 * When a taker specifies `quoteAmount` in their RFQ, their RFQ can be interpreted in the following way:
 *
 * *"I am selling the base asset for `quoteAmount` of the quote asset. What amount of the base asset must I offer?"*
 * @property {UseCase} [useCase] - The use case. Use cases enable more complex workflows to be supported by the RFQ system.
 * Use cases change the following behavior for the system:
 * - Impose rules for order construction and validation.
 * - Can constrain acceptable values for `executor`.
 * - Can impose additional metadata requirements via `useCaseMetadata`.
 * - Are only supported for a subset of markets (described by {@link Market.validUseCases}).
 * @property {Record<string, any>} [useCaseMetadata] - The use case metadata. Should only be defined if `useCase` is defined.
 * The structure of this object depends on the use case. TODO: More details here.
 * @interface
 */
export interface TakerProviderRequestQuoteArgs {
  baseAssetAddress: string;
  quoteAssetAddress: string;
  baseAssetChainId: number;
  quoteAssetChainId: number;
  executor: OrderExecutor;
  baseAmount?: string;
  quoteAmount?: string;
  quoteAssetReceiver?: string;
  useCase?: UseCase;
  useCaseMetadata?: Record<string, unknown>;
}

/** Input arguments for {@link TakerProvider.acceptQuote}.
 *
 * @property {number} quoteId - The ID of the quote to accept. Quotes are submitted
 * on a per RFQ basis so the quote uniquely maps to a single RFQ (so we don't need
 * to specify the RFQ ID here).
 * @property {SeaportOrderComponents} [components] - The seaport order components.
 * - If the executor is {@link OrderExecutor.MAKER}, this must be specified (taker signs -> maker executes).
 * - If the executor is {@link OrderExecutor.TAKER}, this should not be specified (maker signs -> taker executes).
 * @property {string} [signature] - The signature of the seaport order signature.
 * - If the executor is {@link OrderExecutor.MAKER}, this must be specified (taker signs -> maker executes).
 * - If the executor is {@link OrderExecutor.TAKER}, this should not be specified (maker signs -> taker executes).
 *
 * The signature should be an [EIP-2098](https://eips.ethereum.org/EIPS/eip-2098) compact signature as this is the
 * signature format that seaport requires. This means that the signature should be 64 bytes instead of 65 bytes.
 * @interface
 */
export interface TakerProviderAcceptQuoteArgs {
  quoteId: number;
  components?: SeaportOrderComponents;
  signature?: string;
}

/**
 * The `TakerProvider` facilitates interactions with the Hourglass RFQ system `/taker` namespace.
 *
 * The `/taker` namespaces enables clients to create and manage RFQ's on the platform. The primary
 * actions that takers can perform are:
 * - Create a RFQ (see {@link TakerProvider.requestQuote}).
 * - Accept a quote for an RFQ (see {@link TakerProvider.acceptQuote}).
 *
 * This class extends an event emitter and proxies events from the underlying websocket to
 * itself so that SDK consumers can listen for events without managing the websocket.
 *
 * @example
 * ```typescript
 * const takerProvider = new TakerProvider();
 * ```
 */
export class TakerProvider extends BaseProvider<
  TakerEventsMap,
  TakerMethod,
  AuthTakerUser
> {
  /*//////////////////////////////////////////////////////////////
                              CONNECT
    //////////////////////////////////////////////////////////////*/

  protected setupListeners(socket: Socket, rs: ReconnectionState) {
    socket.on(
      WebsocketEvent.AccessToken,
      (data: PayloadAccessToken, callback: SocketOnCallback) => {
        this.log(
          `Event '${WebsocketEvent.AccessToken}': ${JSON.stringify(data)}`
        );
        rs.setAccessToken(data.accessToken);
        this.emit(WebsocketEvent.AccessToken, data, undefined);
        callback('ACK');
      }
    );

    socket.on(
      WebsocketEvent.BestQuote,
      (data: PayloadBestQuote, callback: SocketOnCallback) => {
        this.log(
          `Event '${WebsocketEvent.BestQuote}': ${JSON.stringify(data)}`
        );
        this.emit(WebsocketEvent.BestQuote, data, undefined);
        callback('ACK');
      }
    );

    socket.on(
      WebsocketEvent.OrderFulfilled,
      (data: PayloadOrderFulfilled, callback: SocketOnCallback) => {
        this.log(
          `Event '${WebsocketEvent.OrderFulfilled}': ${JSON.stringify(data)}`
        );
        this.emit(WebsocketEvent.OrderFulfilled, data, undefined);
        callback('ACK');
      }
    );

    socket.on(
      WebsocketEvent.OrderCreated,
      (data: PayloadOrderCreated, callback: SocketOnCallback) => {
        this.log(
          `Event '${WebsocketEvent.OrderCreated}': ${JSON.stringify(data)}`
        );
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
   * Establishes a connection to the websocket server for the `/taker` namespace.
   *
   * @param {TakerProviderConnectArgs} args - Input args.
   *
   * @example
   * ```typescript
   * import { SERVER_URL_STAGING } from '@hourglass/sdk';
   *
   * takerProvider.connect({ serverUrl: SERVER_URL_STAGING });
   * takerProvider.on('connect', () => {
   *  console.log("Successfully connected to the server");
   * })
   * takerProvider.on('connect_error', (error) => {
   *  console.error(`Failed to connect to the server: ${error.message}`);
   * })
   * takerProvider.on('disconnect', (reason, description) => {
   *  console.log(`Disconnected from the server: ${reason}`);
   * })
   * takerProvider.on(WebsocketEvent.AccessToken, (data: PayloadAccessToken) => {
   *  // logic to store access token for future use.
   *  // If operating in a browser, persistent storage (i.e. localStorage) can be used
   *  // so that sessions can be resumed across page reloads.
   * })
   * ```
   * @category Connect
   */
  connect({ auth, serverUrl }: TakerProviderConnectArgs) {
    super.connectEntrypoint({
      endpoint: new URL('taker', serverUrl).toString(),
      auth,
    });
  }

  /*//////////////////////////////////////////////////////////////
                              ACTIONS
    //////////////////////////////////////////////////////////////*/

  /**
   * Create a request for quote (RFQ).
   *
   * - This method triggers the emission of a 'message' event to the server.
   * - The listener for the {@link TakerMethod.hg_requestQuote} will receive the response.
   * - If successful, the type of the response object will be {@link PayloadHgRequestQuote}.
   *
   * @param {TakerProviderRequestQuoteArgs} args - Input args.
   *
   * @example
   * ```typescript
   *  import { UseCase, OrderExecutor } from '@hourglass/sdk';
   *
   *  takerProvider.requestQuote({
   *    baseAssetAddress: '0x...',
   *    quoteAssetAddress: '0x...',
   *    baseAssetChainId: 1,
   *    quoteAssetChainId: 1,
   *    baseAmount: '1000000000000000000', // 1 ether in wei
   *    executor: OrderExecutor.TAKER,
   *    // no use case specified -> UseCase.DEFAULT
   *    // no metadata required for default use case
   *  });
   *  takerProvider.on(TakerMethod.hg_requestQuote, (data: PayloadHgRequestQuote, error) => {
   *    if (error) {
   *      console.error(`Error requesting quote: ${error}`);
   *      return;
   *    }
   *    // Call was successful, store details of created RFQ locally
   *  });
   *  takerProvider.on(WebsocketEvent.BestQuote, (data: PayloadBestQuote, error) => {
   *    if (error) {
   *      console.error(`Error receiving best quote: ${error}`);
   *      return;
   *    }
   *   // New best quote received, update local state
   *  })
   * ```
   * @category Actions
   */
  requestQuote(args: TakerProviderRequestQuoteArgs) {
    if (
      (args.baseAmount && args.quoteAmount) ||
      (!args.baseAmount && !args.quoteAmount)
    ) {
      throw new Error('Must specify either baseAmount XOR quoteAmount.');
    }
    if (args.executor === OrderExecutor.TAKER && args.quoteAssetReceiver) {
      throw new Error(
        'If executor = OrderExecutor.TAKER, quoteAssetReceiver should not be specified.'
      );
    }
    if (args.executor === OrderExecutor.MAKER && !args.quoteAssetReceiver) {
      throw new Error(
        'If executor = OrderExecutor.MAKER, quoteAssetReceiver should be specified.'
      );
    }
    this.log(`Requesting quote: ${JSON.stringify(args)}`);
    this.emitMessage(TakerMethod.hg_requestQuote, args);
  }

  /** Accept a quote for an outstanding RFQ.
   *
   * - This method triggers the emission of a 'message' event to the server.
   * - The listener for the {@link TakerMethod.hg_acceptQuote} will receive the response.
   * - If successful, the type of the response object will be {@link PayloadHgAcceptQuote}.
   *
   * @param {TakerProviderAcceptQuoteArgs} args - Input args.
   *
   * @example
   * ```typescript
   *  // quote1.rfq.executor = OrderExecutor.TAKER
   *  takerProvider.acceptQuote({
   *    quoteId: 1,
   *  });
   *
   *  // quote2.rfq.executor = OrderExecutor.MAKER
   *  takerProvider.acceptQuote({
   *    quoteId: 2,
   *    components,
   *    signature,
   *  });
   *
   *  takerProvider.on(TakerMethod.hg_acceptQuote, (data: PayloadHgAcceptQuote, error) => {
   *    if (error) {
   *      console.error(`Error accepting quote: ${error}`);
   *      return;
   *    }
   *    console.log(`Successfully accepted quote ${data}`);
   *  });
   *
   *  // Will only be triggered if `executor` is `OrderExecutor.TAKER`
   *  // In this example, this would happen for quote id 1.
   *  takerProvider.on(WebsocketEvent.OrderCreated, (data: PayloadOrderCreated, error) => {
   *    if (error) {
   *      console.error(`Error receiving order created: ${error}`);
   *      return;
   *    }
   *    console.log(`Recieved order to execute: ${data}`);
   *  });
   * ```
   * @category Actions
   */
  acceptQuote(args: TakerProviderAcceptQuoteArgs) {
    this.log(`Accepting quote: ${JSON.stringify(args)}`);
    this.emitMessage(TakerMethod.hg_acceptQuote, args);
  }
}

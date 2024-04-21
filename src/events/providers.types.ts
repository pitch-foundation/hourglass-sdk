import { ManagerOptions, Socket, SocketOptions } from 'socket.io-client';
import {
  SeaportOrderComponents,
  SeaportOrderComponentsEntity,
} from '../seaport/seaport.types.js';
import {
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY_MSECS,
} from './providers.constants.js';

// ----------------------------------- Enums -----------------------------------

export const UseCase = {
  DEFAULT: 'DEFAULT',
  ION_DELEVERAGE: 'ION_DELEVERAGE',
  HOURGLASS_POINT_LEVERAGE: 'HOURGLASS_POINT_LEVERAGE',
} as const;
export type UseCase = (typeof UseCase)[keyof typeof UseCase];

export const OrderExecutor = {
  MAKER: 'MAKER',
  TAKER: 'TAKER',
} as const;
export type OrderExecutor = (typeof OrderExecutor)[keyof typeof OrderExecutor];

export const Chain = {
  Ethereum: 'Ethereum',
} as const;
export type Chain = (typeof Chain)[keyof typeof Chain];

export const TakerSource = {
  API: 'API',
  HOURGLASS_PROTOCOL: 'HOURGLASS_PROTOCOL',
  ION_PROTOCOL: 'ION_PROTOCOL',
} as const;
export type TakerSource = (typeof TakerSource)[keyof typeof TakerSource];

// ----------------------------------- Events -----------------------------------

export const TakerMethod = {
  hg_requestQuote: 'hg_requestQuote',
  hg_acceptQuote: 'hg_acceptQuote',
} as const;
export type TakerMethod = (typeof TakerMethod)[keyof typeof TakerMethod];

export const MakerMethod = {
  hg_subscribeToMarket: 'hg_subscribeToMarket',
  hg_unsubscribeFromMarket: 'hg_unsubscribeFromMarket',
  hg_submitQuote: 'hg_submitQuote',
} as const;
export type MakerMethod = (typeof MakerMethod)[keyof typeof MakerMethod];

export const DataMethod = {
  hg_getMarkets: 'hg_getMarkets',
} as const;
export type DataMethod = (typeof DataMethod)[keyof typeof DataMethod];

export const WebsocketEvent = {
  AccessToken: 'AccessToken',
  OrderCreated: 'OrderCreated',
  OrderFulfilled: 'OrderFulfilled',
  QuoteAccepted: 'QuoteAccepted',
  RequestForQuoteBroadcast: 'RequestForQuoteBroadcast',
  BestQuote: 'BestQuote',
} as const;
export type WebsocketEvent =
  (typeof WebsocketEvent)[keyof typeof WebsocketEvent];

// ----------------------------------- Authentication -----------------------------------

/**
 * Base interface for authentication
 * @property {string} [token] - The access token.
 *  - If provided, allows the user to skip authentication and resume interactions from previous sessions.
 *  - If not provided, a new access token will be issued to the user upon a successful authentication.
 * @property {boolean} [allowForceDisconnect] - Allow the client to forcibly disconnect existing sockets using a given access token.
 * The system enforces a constraint that only a single connection can exist for a given access token, as access tokens are used as a
 * session identifier. Assuming that there is an existing connection with some access token:
 * - If the flag is true, the existing socket is disconnected and a new socket is established with the access token.
 * - If the flag is false, the existing socket remains connected and a connection error is thrown.
 * @interface
 */
export interface AuthBase {
  token?: string;
  allowForceDisconnect?: boolean;
}

/**
 * Interface for taker API wallet user authentication.
 *
 * Wallet users are a set of users who have a set of whitelisted wallets that they can operate from.
 * They must undergo taker client onboarding in order to receive their client id and secret. During
 * this process, they must prove that they own the set of wallets they wish to operate from.
 *
 * @property {string} source - Source for the Taker API User, must be {@link TakerSource.API}.
 * @property {string} clientId - Client id for the taker api wallet user.
 * @property {string} clientSecret - Client secret for the taker api wallet user.
 */
export interface AuthTakerApiWalletUser extends AuthBase {
  source: typeof TakerSource.API;
  clientId: string;
  clientSecret: string;
}

/**
 * Interface for Taker API protocol user authentication.
 *
 * Protocol users are users who are related to some external protocol. These users will not have a set of whitelisted wallets (responsibility
 * of proving wallet ownership prior to submitting requests is outsourced to external protocols). Each protocol user will have a secret that
 * can be used by multiple users of their protocol for authentication.
 *
 * @property {Exclude<TakerSource, typeof TakerSource.API>} source - Source for the taker API protocol user, set to any {@link TakerSource} except {@link TakerSource.API}.
 * @property {string} secret - secret for the taker API protocol user.
 * @interface
 */
export interface AuthTakerApiProtocolUser extends AuthBase {
  source: Exclude<TakerSource, typeof TakerSource.API>;
  secret: string;
}

/**
 * Union type for taker authentication objects.
 *
 * @type {AuthTakerApiWalletUser | AuthTakerApiProtocolUser} - Can be either AuthTakerApiWalletUser or AuthTakerApiProtocolUser.
 */
export type AuthTakerApiUser =
  | AuthTakerApiWalletUser
  | AuthTakerApiProtocolUser;

/**
 * Interface for maker API user authentication
 *
 * Maker api are a set of users who have a set of whitelisted wallets that they can operate from.
 * They must undergo maker client onboarding in order to receive their client id and secret. During
 * this process, they must prove that they own the set of wallets they wish to operate from.
 *
 * @property {string} clientId - Client id for the maker api user.
 * @property {string} clientSecret - Client secret for the maker api user.
 * @interface
 */
export interface AuthMakerApiUser extends AuthBase {
  clientId: string;
  clientSecret: string;
}

// ----------------------------------- Utility Types -----------------------------------

export type BaseXorQuoteAmount =
  | { quoteAmount: string }
  | { baseAmount: string };

export type ExecutorAndQuoteAssetReceiver =
  | {
      executor: typeof OrderExecutor.MAKER;
      quoteAssetReceiverAddress: string;
    }
  | {
      executor: typeof OrderExecutor.TAKER;
    };

export type Asset = {
  id: number;
  info: {
    address: string;
    chain: Chain;
  };
  erc20: {
    chain: Chain;
    address: string;
    name: string;
    symbol: string;
    description: string | null;
    tokenDecimals: number;
  };
};

export type Market = {
  id: number;
  name: string;
  description: string | null;
  rfqTtlMsecs: number;
  defaultOrderTtlSecs: number;
  minOrderTtlSecs: number;
  maxOrderTtlSecs: number;
  feeBps: number;
  asset0Id: number;
  asset1Id: number;
  asset0: Asset;
  asset1: Asset;
  validUseCases: UseCase[];
};

export type JsonRpcMessage<M extends DataMethod | MakerMethod | TakerMethod> = {
  jsonrpc: string;
  method: M;
  params: unknown;
  id: string;
};

// ----------------------------------- Payloads - Websocket Events -----------------------------------

export type PayloadAccessToken = {
  accessToken: string;
};

export type PayloadBestQuote =
  | {
      rfqId: number;
      bestQuote: null;
    }
  | {
      rfqId: number;
      bestQuote: BaseXorQuoteAmount & {
        quoteId: number;
        createdAt: string;
      };
      seaportOrderComponents: SeaportOrderComponents;
    }
  | {
      rfqId: number;
      bestQuote:
        | null
        | (BaseXorQuoteAmount & {
            quoteId: number;
            createdAt: string;
          });
    };

export type PayloadOrderCreated = {
  id: number;
  createdAt: string;
  components: SeaportOrderComponentsEntity;
  signature: string;
  hash: string;
  extraData: string | null;
  inputChainId: number;
  outputChainId: number;
  rfqId: number;
};

export type PayloadOrderFulfilled = {
  id: number;
  createdAt: Date;
  orderId: number;
  orderHash: string;
  offerer: string;
  zone: string;
  recipient: string;
  block: number;
  transactionHash: string;
  logIndex: number;
};

export type PayloadQuoteAccepted = {
  quoteId: number;
  rfqId: number;
  seaportOrderComponents: SeaportOrderComponents;
};

export type PayloadRequestForQuoteBroadcast = {
  useCase: UseCase;
  executor: OrderExecutor;
  id: number;
  createdAt: Date;
  quoteAssetId: number;
  baseAssetId: number;
  marketId: number;
  baseAmount: string | null;
  quoteAmount: string | null;
};

export type QuoteAcceptedCallbackArgs = {
  components: SeaportOrderComponents;
  signature: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PayloadMessage = { id: string; result: any; error: any };

// ----------------------------------- Payloads - JSON RPC Methods - Taker API -----------------------------------

export type PayloadHgRequestQuote = ExecutorAndQuoteAssetReceiver & {
  rfqId: number;
  baseAssetChainId: number;
  quoteAssetChainId: number;
  baseAssetAddress: string;
  quoteAssetAddress: string;
  ttlMsecs: number;
  useCase: UseCase;
} & (
    | {
        baseAmount: string;
        quoteAmount: null;
      }
    | {
        baseAmount: null;
        quoteAmount: string;
      }
  );

export type PayloadHgAcceptQuote = {
  quoteId: number;
  rfqId: number;
};

// ----------------------------------- Payloads - JSON RPC Methods - Maker API -----------------------------------

export type PayloadHgSubscribeToMarket = {
  marketId: number;
};

export type PayloadHgUnsubscribeFromMarket = {
  marketId: number;
};

export type PayloadHgSubmitQuote = {
  quoteId: number;
  rfqId: number;
  quoteAmount: string;
  createdAt: Date;
};

// ----------------------------------- Payloads - JSON RPC Methods - Data API -----------------------------------

export type PayloadHgGetMarkets = {
  markets: Market[];
};

// ----------------------------------- Event Maps -----------------------------------

export type EventsMapEntryArgs<T> =
  | [data: T, error: undefined]
  | [data: undefined, error: object];

export type EventsMapEntryArgsWithCallback<T, C> =
  | [data: T, error: undefined, callback: (data: C) => void]
  | [data: undefined, error: object];

type SocketIoEventsMap = {
  connect: [];
  disconnect: [
    reason: Socket.DisconnectReason,
    description: unknown | undefined
  ];
  connect_error: [error: Error];
};

export type TakerEventsMap = {
  [TakerMethod.hg_requestQuote]: EventsMapEntryArgs<PayloadHgRequestQuote>;
  [WebsocketEvent.BestQuote]: EventsMapEntryArgs<PayloadBestQuote>;
  [TakerMethod.hg_acceptQuote]: EventsMapEntryArgs<PayloadHgAcceptQuote>;
  [WebsocketEvent.OrderFulfilled]: EventsMapEntryArgs<PayloadOrderFulfilled>;
  [WebsocketEvent.OrderCreated]: EventsMapEntryArgs<PayloadOrderCreated>;
  [WebsocketEvent.AccessToken]: EventsMapEntryArgs<PayloadAccessToken>;
} & SocketIoEventsMap;

export type MakerEventsMap = {
  [MakerMethod.hg_subscribeToMarket]: EventsMapEntryArgs<PayloadHgSubscribeToMarket>;
  [MakerMethod.hg_unsubscribeFromMarket]: EventsMapEntryArgs<PayloadHgUnsubscribeFromMarket>;
  [MakerMethod.hg_submitQuote]: EventsMapEntryArgs<PayloadHgSubmitQuote>;
  [WebsocketEvent.OrderFulfilled]: EventsMapEntryArgs<PayloadOrderFulfilled>;
  [WebsocketEvent.OrderCreated]: EventsMapEntryArgs<PayloadOrderCreated>;
  [WebsocketEvent.RequestForQuoteBroadcast]: EventsMapEntryArgs<PayloadRequestForQuoteBroadcast>;
  [WebsocketEvent.QuoteAccepted]: EventsMapEntryArgsWithCallback<
    PayloadQuoteAccepted,
    QuoteAcceptedCallbackArgs
  >;
  [WebsocketEvent.AccessToken]: EventsMapEntryArgs<PayloadAccessToken>;
} & SocketIoEventsMap;

export type DataEventsMap = {
  [DataMethod.hg_getMarkets]: EventsMapEntryArgs<PayloadHgGetMarkets>;
} & SocketIoEventsMap;

// ----------------------------------- Socket.io -----------------------------------

export type WebsocketConnectOptions = Omit<
  Partial<ManagerOptions & SocketOptions>,
  'transports'
>;

export type SocketOnCallback = (value: string) => void;

// ----------------------------------- Providers -----------------------------------

/**
 * Constructor arguments to the base provider class.
 * @property {boolean} [debug] - Flag to enable / disable logging.
 * @property {Function} [logger] - A function that logs messages.
 *  - If not provided and debug is true, logs are printed to the console.
 *  - If provided and debug is true, we use custom logging function provided.
 *  - If not provided and debug is false, logs are suppressed.
 * @property {WebsocketConnectOptions} [connectOpts] - Options that are passed through to the internal call to socket.io's `connect` method.
 * @property {number} [retryDelayMsecs] - The delay between reconnection attempts in milliseconds. Defaults to {@link DEFAULT_RETRY_DELAY_MSECS}.
 * @property {number} [maxRetries] - The maximum number of reconnection attempts. Defaults to {@link DEFAULT_MAX_RETRIES}.
 * @interface
 */
export type ProviderConstructorArgs = {
  debug?: boolean;
  logger?: (message: string) => void;
  connectOpts?: WebsocketConnectOptions;
  maxRetries?: number;
  retryDelayMsecs?: number;
};

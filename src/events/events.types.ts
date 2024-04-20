import { ManagerOptions, Socket, SocketOptions } from 'socket.io-client';
import {
  SeaportOrderComponents,
  SeaportOrderComponentsEntity,
} from '../seaport/seaport.types.js';

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

type AuthBase = {
  token?: string;
  allowForceDisconnect?: boolean;
};

export type TakerAuth = AuthBase &
  (
    | {
        source: typeof TakerSource.API;
        clientId: string;
        clientSecret: string;
      }
    | {
        source: Exclude<TakerSource, typeof TakerSource.API>;
        secret: string;
      }
  );

export type MakerAuth = AuthBase & {
  clientId: string;
  clientSecret: string;
};

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

export type ProviderConstructorArgs = {
  logger?: (message: string) => void;
  debug?: boolean;
  connectOpts?: WebsocketConnectOptions;
  maxRetries?: number;
  retryDelayMsecs?: number;
};

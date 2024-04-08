import { Socket } from 'socket.io-client';
import {
  SeaportOrderComponents,
  SeaportOrderComponentsEntity,
} from '../seaport/seaport.types';
import { DisconnectDescription } from 'socket.io-client/build/esm/socket';

export type BaseXorQuoteAmount =
  | { quoteAmount: string }
  | { baseAmount: string };

export type UseCase = 'DEFAULT' | 'ION_DELEVERAGE';
export type OrderExecutor = 'MAKER' | 'TAKER';

export type ExecutorAndQuoteAssetReceiver =
  | {
      executor: 'MAKER';
      quoteAssetReceiverAddress: string;
    }
  | {
      executor: 'TAKER';
    };

export type OrderFulfilledType = {
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

export type OrderCreatedType = {
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

export type SubmitQuoteType = {
  quoteId: number;
  rfqId: number;
  quoteAmount: string;
  createdAt: Date;
};

export type RequestQuoteType = {
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
) &
  ExecutorAndQuoteAssetReceiver;

export type RequestForQuoteBroadcastType =
  | {
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
    ) &
      ExecutorAndQuoteAssetReceiver;

export type QuoteAcceptedType = {
  quoteId: number;
  rfqId: number;
  seaportOrderComponents: SeaportOrderComponents;
};

export type AcceptQuoteType = {
  quoteId: number;
  rfqId: number;
};

export type AccessTokenType = {
  accessToken: string;
};

export type UnsubscribeFromMarketType = {
  marketId: number;
};

export type BestQuoteType =
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

export type TakerEventsMap = {
  [TakerMethod.hg_requestQuote]: [
    RequestQuoteType | undefined,
    error: object | undefined
  ];
  [HourglassWebsocketEvent.BestQuote]: [
    BestQuoteType | undefined,
    error: object | undefined
  ];
  [TakerMethod.hg_acceptQuote]: [
    AcceptQuoteType | undefined,
    error: object | undefined
  ];
  [HourglassWebsocketEvent.OrderFulfilled]: [
    OrderFulfilledType | undefined,
    error: object | undefined
  ];
  [HourglassWebsocketEvent.OrderCreated]: [
    OrderCreatedType | undefined,
    error: object | undefined
  ];
  [HourglassWebsocketEvent.AccessToken]: [
    AccessTokenType,
    error: object | undefined
  ];
  connect: [];
  disconnect: [
    reason: Socket.DisconnectReason,
    description: DisconnectDescription | undefined
  ];
  connect_error: [error: Error];
};

export type MakerEventsMap = {
  [MakerMethod.hg_subscribeToMarket]: [
    {
      marketId: number;
    },
    error: object | undefined
  ];
  [MakerMethod.hg_unsubscribeFromMarket]: [
    UnsubscribeFromMarketType,
    error: object | undefined
  ];
  [MakerMethod.hg_submitQuote]: [
    SubmitQuoteType | undefined,
    error: object | undefined
  ];
  [HourglassWebsocketEvent.OrderFulfilled]: [
    OrderFulfilledType | undefined,
    error: object | undefined
  ];
  [HourglassWebsocketEvent.OrderCreated]: [
    OrderCreatedType | undefined,
    error: object | undefined
  ];
  [HourglassWebsocketEvent.RequestForQuoteBroadcast]: [
    RequestForQuoteBroadcastType | undefined,
    error: object | undefined
  ];
  [HourglassWebsocketEvent.QuoteAccepted]: [
    QuoteAcceptedType | undefined,
    error: object | undefined
  ];
  [HourglassWebsocketEvent.AccessToken]: [
    AccessTokenType,
    error: object | undefined
  ];
  connect: [];
  disconnect: [
    reason: Socket.DisconnectReason,
    description: DisconnectDescription | undefined
  ];
  connect_error: [error: Error];
};

export enum TakerMethod {
  hg_requestQuote = 'hg_requestQuote',
  hg_acceptQuote = 'hg_acceptQuote',
}

export enum MakerMethod {
  hg_subscribeToMarket = 'hg_subscribeToMarket',
  hg_unsubscribeFromMarket = 'hg_unsubscribeFromMarket',
  hg_submitQuote = 'hg_submitQuote',
}

export enum HourglassWebsocketEvent {
  AccessToken = 'AccessToken',
  OrderCreated = 'OrderCreated',
  OrderFulfilled = 'OrderFulfilled',
  QuoteAccepted = 'QuoteAccepted',
  RequestForQuoteBroadcast = 'RequestForQuoteBroadcast',
  BestQuote = 'BestQuote',
}

export type DataEventsMap = {
  [DataMethod.hg_getMarkets]: [
    (
      | {
          markets: RFQMarket[];
        }
      | undefined
    ),
    error: object | undefined
  ];
};

export enum DataMethod {
  hg_getMarkets = 'hg_getMarkets',
}

export type RfqType = 'MAKER_FILLS' | 'QUOTER_FILLS';

type RFQChain = 'Ethereum' | 'Fraxtal';

type RFQMarketAsset = {
  info: {
    assetId: number;
    address: string;
    chain: RFQChain;
  };
  erc20: {
    id: number;
    chain: RFQChain;
    address: string;
    name: string;
    symbol: string;
    description: string | null;
    tokenDecimals: number;
  } | null;
};

export type RFQMarket = {
  asset0: RFQMarketAsset;
  asset1: RFQMarketAsset;
};

export type TakerSource = 'API' | 'HOURGLASS_PROTOCOL' | 'ION_PROTOCOL';

export type AuthType = {
  clientId: string;
  clientSecret: string;
  token?: string;
};

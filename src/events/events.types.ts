import {
  SeaportOrderComponents,
  SeaportOrderComponentsEntity,
} from '../seaport/seaport.types';

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

export type OrderFulfilled = {
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

export type TakerEventsMap = {
  [TakerMethod.hg_requestQuote]: [
    (
      | ({
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
          ExecutorAndQuoteAssetReceiver)
      | undefined
    ),
    error: object | undefined
  ];
  [HourglassWebsocketEvent.BestQuote]: [
    (
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
        }
      | undefined
    ),
    error: object | undefined
  ];
  [TakerMethod.hg_acceptQuote]: [
    (
      | {
          quoteId: number;
          rfqId: number;
        }
      | undefined
    ),
    error: object | undefined
  ];
  [HourglassWebsocketEvent.OrderFulfilled]: [
    OrderFulfilled | undefined,
    error: object | undefined
  ];
};

export type MakerEventsMap = {
  [MakerMethod.hg_subscribeToMarket]: [
    {
      marketId: number;
    },
    error: object | undefined
  ];
  [MakerMethod.hg_unsubscribeFromMarket]: [
    {
      marketId: number;
    },
    error: object | undefined
  ];
  [MakerMethod.hg_submitQuote]: [
    {
      quoteId: number;
      rfqId: number;
      quoteAmount: string;
      createdAt: Date;
    },
    error: object | undefined
  ];
  [HourglassWebsocketEvent.OrderFulfilled]: [
    OrderFulfilled | undefined,
    error: object | undefined
  ];
  [HourglassWebsocketEvent.OrderCreated]: [
    (
      | {
          id: number;
          createdAt: string;
          components: SeaportOrderComponentsEntity;
          signature: string;
          hash: string;
          extraData: string | null;
          inputChainId: number;
          outputChainId: number;
          rfqId: number;
        }
      | undefined
    ),
    error: object | undefined
  ];
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

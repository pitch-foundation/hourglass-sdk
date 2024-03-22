import { SeaportOrderComponents } from '../seaport/seaport.types';

export type RFQEventsMap = {
  RequestQuote: [
    {
      rfqId: number;
      ttlMsecs: number;
      type: RfqType;
      baseAssetAddress: string;
      quoteAssetAddress: string;
      baseAmount: string;
      chainId: number;
    }
  ];
  BestQuote: [
    | {
        rfqId: number;
        rfqType: typeof RfqTypeEnum.QUOTER_FILLS;
        bestQuote: null;
      }
    | {
        rfqId: number;
        rfqType: typeof RfqTypeEnum.QUOTER_FILLS;
        bestQuote: {
          quoteId: number;
          quoteAmount: string;
          createdAt: string;
        };
        seaportOrderComponents: SeaportOrderComponents;
      }
    | {
        rfqId: number;
        rfqType: typeof RfqTypeEnum.MAKER_FILLS;
        bestQuote: null | {
          quoteId: number;
          quoteAmount: string;
          createdAt: string;
        };
      }
  ];
  AcceptQuote: [
    {
      quoteId: number;
      rfqId: number;
    }
  ];
  OrderFulfilled: [
    {
      id: number;
      createdAt: Date;
      orderId: number | null;
      orderHash: string;
      offerer: string;
      zone: string;
      recipient: string;
      block: number;
      transactionHash: string;
      logIndex: number;
    }
  ];
};

export enum RFQMethod {
  hg_subscribeToMarket = 'hg_subscribeToMarket',
  hg_unsubscribeFromMarket = 'hg_unsubscribeFromMarket',
  hg_requestQuote = 'hg_requestQuote',
  hg_submitQuote = 'hg_submitQuote',
  hg_acceptQuote = 'hg_acceptQuote',
}

export enum HourglassWebsocketEvent {
  message = 'message',
  AccessToken = 'AccessToken',
  OrderCreated = 'OrderCreated',
  OrderFulfilled = 'OrderFulfilled',
  QuoteAccepted = 'QuoteAccepted',
  RequestForQuoteBroadcast = 'RequestForQuoteBroadcast',
  BestQuote = 'BestQuote',
}

export type DataEventsMap = {
  GetMarkets: [
    {
      markets: RFQMarket[];
    }
  ];
};

export enum DataMethod {
  hg_getMarkets = 'hg_getMarkets',
}

export type RfqType = 'MAKER_FILLS' | 'QUOTER_FILLS';

export enum RfqTypeEnum {
  MAKER_FILLS = 'MAKER_FILLS',
  QUOTER_FILLS = 'QUOTER_FILLS',
}

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

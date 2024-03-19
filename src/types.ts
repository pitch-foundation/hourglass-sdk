export enum RFQMethod {
  hg_subscribeToMarket = 'hg_subscribeToMarket',
  hg_unsubscribeFromMarket = 'hg_unsubscribeFromMarket',
  hg_requestQuote = 'hg_requestQuote',
  hg_submitQuote = 'hg_submitQuote',
  hg_acceptQuote = 'hg_acceptQuote',
}

export enum DataMethod {
  hg_getMarkets = 'hg_getMarkets',
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

export type RfqType = 'MAKER_FILLS' | 'QUOTER_FILLS';

export enum RfqTypeEnum {
  MAKER_FILLS = 'MAKER_FILLS',
  QUOTER_FILLS = 'QUOTER_FILLS',
}

export type RFQChain = 'Ethereum' | 'Fraxtal';

export type RFQMarketAsset = {
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

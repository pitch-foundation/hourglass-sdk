import { SeaportOrderComponents } from './seaport.types';
import { RFQMarket, RfqType, RfqTypeEnum } from './types';

export type EventsMap = {
  requestQuote: [
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
  bestQuote: [
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
  acceptQuote: [
    {
      quoteId: number;
      rfqId: number;
    }
  ];
  orderFulfilled: [
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
  getMarkets: [
    {
      markets: RFQMarket[];
    }
  ];
};

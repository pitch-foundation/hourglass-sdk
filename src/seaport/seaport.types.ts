export type SeaportOfferItemEntityItemType =
  (typeof SeaportOfferItemEntityItemType)[keyof typeof SeaportOfferItemEntityItemType];

export const SeaportOfferItemEntityItemType = {
  NUMBER_0: 0,
  NUMBER_1: 1,
  NUMBER_2: 2,
  NUMBER_3: 3,
  NUMBER_4: 4,
  NUMBER_5: 5,
} as const;

export type SeaportOfferItemEntity = {
  endAmount: string;
  identifierOrCriteria: string;
  itemType: SeaportOfferItemEntityItemType;
  startAmount: string;
  token: string;
};

export type SeaportOrderComponentsEntityOrderType =
  (typeof SeaportOrderComponentsEntityOrderType)[keyof typeof SeaportOrderComponentsEntityOrderType];

export const SeaportOrderComponentsEntityOrderType = {
  NUMBER_0: 0,
  NUMBER_1: 1,
  NUMBER_2: 2,
  NUMBER_3: 3,
} as const;

export type SeaportConsiderationItemEntityItemType =
  (typeof SeaportConsiderationItemEntityItemType)[keyof typeof SeaportConsiderationItemEntityItemType];

export const SeaportConsiderationItemEntityItemType = {
  NUMBER_0: 0,
  NUMBER_1: 1,
  NUMBER_2: 2,
  NUMBER_3: 3,
  NUMBER_4: 4,
  NUMBER_5: 5,
} as const;

export type SeaportConsiderationItemEntity = {
  endAmount: string;
  identifierOrCriteria: string;
  itemType: SeaportConsiderationItemEntityItemType;
  recipient: string;
  startAmount: string;
  token: string;
};

export type SeaportOrderComponentsEntity = {
  conduitKey: string;
  consideration: SeaportConsiderationItemEntity[];
  counter: string;
  endTime: number;
  offer: SeaportOfferItemEntity[];
  offerer: string;
  orderType: SeaportOrderComponentsEntityOrderType;
  salt: string;
  startTime: number;
  zone: string;
  zoneHash: string;
};

export enum SeaportItemType {
  NATIVE,
  ERC20,
  ERC721,
  ERC1155,
  ERC721_WITH_CRITERIA,
  ERC1155_WITH_CRITERIA,
}

// Enum values (ints) are the same as those used by seaport.js. This differs from
// the underlying representation format that we use in our database.
export enum SeaportOrderType {
  FULL_OPEN, // No partial fills, anyone can execute
  PARTIAL_OPEN, // Partial fills supported, anyone can execute
  FULL_RESTRICTED, // No partial fills, only offerer or zone can execute
  PARTIAL_RESTRICTED, // Partial fills supported, only offerer or zone can execute
}

export type SeaportOfferItem = {
  itemType: SeaportItemType;
  token: string;
  identifierOrCriteria: string;
  startAmount: string;
  endAmount: string;
};

export type SeaportConsiderationItem = {
  itemType: SeaportItemType;
  token: string;
  identifierOrCriteria: string;
  startAmount: string;
  endAmount: string;
  recipient: string;
};

export type SeaportOrderParameters = {
  offerer: string;
  zone: string;
  orderType: SeaportOrderType;
  startTime: number;
  endTime: number;
  zoneHash: string;
  salt: string;
  offer: SeaportOfferItem[];
  consideration: SeaportConsiderationItem[];
  totalOriginalConsiderationItems: number;
  conduitKey: string;
};

export type SeaportOrderComponents = Omit<
  SeaportOrderParameters,
  'totalOriginalConsiderationItems'
> & { counter: string };

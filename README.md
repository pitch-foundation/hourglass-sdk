# Hourglass SDK

The Hourglass SDK provides a set of tools and utilities for interacting with the Hourglass RFQ protocol and Seaport marketplace.

## Installation

```bash
npm install @hourglass/sdk
```

### Installation Through Github (using npm)

```bash
npm install git+https://github.com/pitch-foundation/hourglass-sdk.git
```

## Usage - TakerProvider

### Init

```typescript
import { TakerProvider } from '@hourglass/sdk';

const takerProvider = new TakerProvider();

takerProvider.connect({
  auth: {
    source: 'HOURGLASS_PROTOCOL',
    secret: 'secret_pass',
  },
  endpoint: 'ws://rfq.hourglass.com/taker',
});
```

### Requesting a Quote

```typescript
import { TakerProvider, TakerMethod, WebsocketEvent } from '@hourglass/sdk';

// ...init TakerProvider

takerProvider.requestQuote({
  executor: 'TAKER',
  baseAssetAddress: '',
  baseAssetChainId: 1,
  baseAmount: '', // ethers v5 BigNumber as string
  quoteAssetAddress: '',
  quoteAssetChainId: 1,
});

takerProvider.on(TakerMethod.hg_requestQuote, (data, error) => {
  if (error) {
    console.error(`Error in ${TakerMethod.hg_requestQuote}: ${error}`);
    return;
  }
  console.log(`Quote received: ${data}`);
});
takerProvider.on(WebsocketEvent.BestQuote, (data, error) => {
  if (error) {
    console.error(`Error in ${WebsocketEvent.BestQuote}: ${error}`);
    return;
  }
  console.log(`Best quote received: ${data}`);
});
```

### Accepting a Quote

```typescript
import { TakerProvider, TakerMethod, WebsocketEvent } from '@hourglass/sdk';

// ...init TakerProvider

takerProvider.acceptQuote({
  quoteId: 99,
});

takerProvider.on(TakerMethod.hg_acceptQuote, (data, error) => {
  if (error) {
    console.error(`Error in ${TakerMethod.hg_acceptQuote}: ${error}`);
    return;
  }
  console.log(`Quote accepted: ${data}`); // the quote just accepted by the taker, not yet signed by the maker
});
takerProvider.on(WebsocketEvent.OrderCreated, (data, error) => {
  if (error) {
    console.error(`Error in ${WebsocketEvent.OrderCreated}: ${error}`);
    return;
  }
  console.log(`Order created: ${data}`); // the order is also signed by the maker at this point
});
```

### Fulfilling a Quote

```typescript
import {
  getSeaport,
  HOURGLASS_SEAPORT_ADDRESSES,
  WebsocketEvent,
} from '@hourglass/sdk';

// ...init TakerProvider

let acceptedQuote;
takerProvider.on(WebsocketEvent.OrderCreated, (data, error) => {
  acceptedQuote = {
    seaportOrderComponents: data.components,
    signature: data.signature,
  };
});

// ...later

const seaportV5 = getSeaport(signer); // ethers `JsonRpcSigner`, use `getEthersSigner` adaptor if using `viem`
const response = await seaportV5.fulfillOrder({
  order: {
    parameters: {
      ...acceptedQuote.seaportOrderComponents,
      totalOriginalConsiderationItems:
        acceptedQuote.seaportOrderComponents.consideration.length,
    },
    signature: acceptedQuote.signature,
  },
  accountAddress: HOURGLASS_SEAPORT_ADDRESSES.seaportRollingZone,
  conduitKey: HOURGLASS_SEAPORT_ADDRESSES.seaportConduitKey,
});

const [exchangeAction] = response.actions.filter((f) => f.type === 'exchange');
if (!exchangeAction)
  throw new Error('Missing exchange action for fill limit action');

await exchangeAction.transactionMethods.buildTransaction();
const { hash: txhash, wait } =
  await exchangeAction.transactionMethods.transact();
const result = await wait();
```

## Usage - DataProvider

### Init

```typescript
import { DataProvider } from '@hourglass/sdk';

const dataProvider = new DataProvider();

dataProvider.connect({
  endpoint: 'ws://rfq.hourglass.com/data',
});
```

### Reading Data

```typescript
import { DataProvider, DataMethod } from '@hourglass/sdk';

// ...init DataProvider

dataProvider.requestMarkets();
dataProvider.on(DataMethod.hg_getMarkets, (data, error) => {
  if (error) {
    console.error(`Error in ${DataMethod.hg_getMarkets}: ${error}`);
    return;
  }
  console.log(`Markets received: ${data}`);
});
```

## Usage - MakerProvider

### Init

```typescript
import { MakerProvider } from '@hourglass/sdk';

const makerProvider = new MakerProvider();

makerProvider.connect({
  auth: {
    clientId: '',
    clientSecret: '',
  },
  endpoint: 'ws://rfq.hourglass.com/maker',
});
```

### Submitting a Quote

```typescript
import { MakerProvider, MakerMethod } from '@hourglass/sdk';

// ...init MakerProvider

makerProvider.submitQuote({
  quoteAmount: '', // ethers v5 BigNumber as string
  rfqId: 99,
});

makerProvider.on(MakerMethod.hg_submitQuote, (data, error) => {
  if (error) {
    console.error(`Error in ${MakerMethod.hg_submitQuote}: ${error}`);
    return;
  }
  console.log(`Quote submitted: ${data}`);
});
```

### Signing a Quote

```typescript
import {
  MakerProvider,
  WebsocketEvent,
  signSeaportOrderComponents,
} from '@hourglass/sdk';

// ...init MakerProvider
let makerAddress;

makerProvider.on(
  WebsocketEvent.QuoteAccepted,
  async (data, error, callback) => {
    if (error) {
      console.error(`Error in ${WebsocketEvent.QuoteAccepted}: ${error}`);
      return;
    }
    const seaportOrderComponents = data.seaportOrderComponents;
    seaportOrderComponents['offerer'] = makerAddress;
    seaportOrderComponents['consideration'][0]['recipient'] = makerAddress;
    const signature = await signSeaportOrderComponents(
      signer,
      seaportOrderComponents
    );
    callback({ components: seaportOrderComponents, signature });
  }
);
```

## Project Architecture

### Event Providers

The SDK provides a set of utilities for interacting with the Hourglass RFQ Websockets API. The utilities are located in the `src/events` folder:

- `events.data-provider.ts`: Websockets provider for reading data related to the Hourglass RFQ protocol.
- `events.taker-provider.ts`: Websockets provider for market taker actions like requesting and accepting a quote.
- `events.maker-provider.ts`: Websockets provider for market maker actions like creating and signing quotes.
- `events.constants.ts`: Constants for the Hourglass RFQ Websockets API.
- `events.types.ts`: Types for the Hourglass RFQ Websockets API.
- `events.utils.ts`: Utilities for the Hourglass RFQ Websockets API.

### Chain interactions

The SDK provides a set of utilities for interacting with the Ethereum mainnet and Seaport marketplace. The utilities are located in the `src/chain` folder:

- `src/chain/chain.actions.ts`: Utilities for interacting with the Ethereum mainnet.
- `src/chain/chain.state.ts`: Utilities for reading the state of the Ethereum mainnet.
- `src/chain/chain.adaptors.ts`: Adaptors for usage alongside `viem` (as the SDK works with `ethers` under the hood).
- `src/seaport/seaport.utils.ts`: Utilities for the Seaport marketplace.
- `src/seaport/seaport.types.ts`: Types for the Seaport marketplace.

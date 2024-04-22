# Hourglass SDK

The Hourglass SDK provides a set of tools and utilities for interacting with the Hourglass RFQ protocol and Seaport marketplace.

### Installation Through Github (using npm)

```bash
npm i git+https://github.com/pitch-foundation/hourglass-sdk.git
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

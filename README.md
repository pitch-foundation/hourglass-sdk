# Hourglass SDK

The Hourglass SDK provides a set of tools and utilities for interacting with the Hourglass RFQ system.

## Installation Through Github (using npm)

```bash
npm i git+https://github.com/pitch-foundation/hourglass-sdk.git
```

## Hourglass RFQ System

The Hourglass RFQ system is an offchain intent-based signature matching repository and engine.

Users perform interactive programmatic flows (facilitated by underlying websocket connections) to come to an agreement on
a desirable price for swapping two assets between counterparties. The swap amounts based on this price are encoded in a signed
seaport order (an EIP-712 signed message) which is then transmitted to a user for execution. Execution either occurs through the
seaport contract function `fulfillOrder` or through some other function on a supported seaport zone (depends on the use case).

### Core Concepts

Here is an overview of some of the high level concepts within the RFQ system that are important to understand when
writing code that interacts with the system programatically.

- **RFQ**: A request for quote. This is a request to establish a price agreement between two counterparties.
- **Quote**: A quoted price for a single RFQ. This establishes an exchange rate between two assets that can either
  be accepted or rejected by user who submitted the RFQ (i.e. it is non-binding).
- **Asset**: An asset supported on the Hourglass platform. Currently only a subset of ERC20 assets are supported.
- **Market**: An asset pair supported for trading between on the Hourglass platform.
  - Every RFQ must reference a valid market.
  - Markets each have an associated set of metadata that control other kinds of system behaviors like
    - The amount of time RFQs are open for quotes.
    - Min, max, and default ttl's for signed orders.
    - The set of supported use cases (detailed later).
- **Use Cases**: Each market has one or more supported use cases. Though at its core the system facilitates price
  agreements between counterparties, use cases enable more complex intent based flows otherwise not possible.
  The use cases impose constraints on the structure of signed seaport orders to ensure that idiosyncratic control
  flow hooks are able to perform the requisite set of operations to fulfill a trade between counterparties. See
  the section on use cases below for a detailed explanation + examples.
- **Order**: An order refers to a signed EIP-712 message that can be atomically executed to swap assets between
  two users of the system. The RFQ system validates the structure of signed orders prior to transmitting them
  to the executor. The valid structure is a function of the use case of the RFQ. Additionally, the system enables
  either the maker or the taker to be the executor of the signed order.

### RFQ Lifecycle

The core component of the system is the RFQ, which is a request to trade one asset for another submitted by a taker api user.
The basic flow is as follows

1. A taker api user submits an RFQ. The RFQ is specific to some asset pair (a market) and the user specifies what they're selling, the `baseAsset`
   and what they're buying, the `quoteAsset`. The user then specifies either `baseAmount` or `quoteAmount` and the market maker quotes the other side.

   - If the taker specifies the `baseAmount`, they are asking the question: _"I have `baseAmount` of `baseAsset`, how many units of `quoteAsset` will I receive for selling this?"_
   - If the taker specifies the `quoteAmount`, they are asking the question: _"I want `quoteAmount` of `quoteAsset`, how many units of `baseAsset` do I need to sell you to receive this?"_

2. After being submitted to the system, the RFQ is considered open for quotes.

   - The duration that the RFQ is open for quoting is determined by `market.rfqTtlMsecs` for the RFQ's target market.
   - During this time window, subscribed makers will submit price quotes for this single RFQ (price quotes are unique to a single RFQ).

3. Once a taker has received one or more quotes, they can evaluate the price and either accept or reject (rejection occurs via a NOOP).
4. The system will request the signed order payload from either the maker or taker depending on the RFQ configuration.

   - Once the signed order payload is received on the server, it will be validated for correctness.

5. Once considered valid, the signed seaport order payload will be transmitted to either the maker or the taker for execution.
6. The RFQ system listens for order fulfillments and notifies both the maker and taker once they occur.

### User Types

There are two main kinds of users who interface with the system.

1. **makers**: Those who are submitting price quotes for RFQs. These users will interface with the `MakerProvider`.
2. **takers**: Those who are generating RFQs. These users will interface with the `TakerProvider`.

Some kinds of users require a whitelisted set of wallets that they will operate from. This wallet set applies in cases where makers are
signing orders and the `offerer` within the seaport order struct must be one of these wallets.

To onboard to the platform, please get in contact with the Hourglass team so they can provide you a set of credentials.

#### Makers

Users who want to onboard as a maker will have to come up with a unique name for their client and have a set of whitelisted wallets.

They will be given a secure client id and secret that they can use for API authentication.

#### Takers

There are two kinds of taker API users.

1. **Wallet users**

- These users will be provided a secure client id and secret.
- These users are required to specify a set of whitelisted wallets when onboarding.

2. **Protocol users**: Users who are specific to some external protocol (i.e. Hourglass, Ion, etc.).

- These users have a client id and client secret that is okay to publicly share as this will be used
  by multiple users interacting with the platform via some external website.
- There are no requirements here for a whitelisted set of wallets.

Additionally, takers require special permissions to particpate in various use cases. Specify which use cases you would like to participate
in during onboarding and these permissions will be attached to your client.

### Use Cases

The use case, specified when submitting an RFQ, influences the structure of the signed order payload. For non-default use cases, the payload
will have different kinds of features specific to the use case that require extra care when validating.

The current set of use cases include:

- **DEFAULT**: A simple limit order swap.
- **ION_DELEVERAGE**: Swapping a lending asset for a collateral asset for Ion Protocol. Details below.

#### DEFAULT

A simple swap of assets at an agreed upon price.

#### Ion Deleverage

This use case enables ion protocol users to deleverage a debt position without requiring a balance of the borrowed asset up front.

For example: Let's say that a user borrowed wstETH against rswETH collateral.

- In order to deleverage the position without Hourglass, the end user would have to acquire wstETH, pay down the debt, then withdraw the collateral.
- Using Hourglass, the following set of operations occur atomically in a single transaction:
  1. A maker provides wstETH to a taker.
  2. The taker (an Ion protocol user) uses this wstETH to pay down their debt, unlocking some quantity of rswETH collateral.
  3. The taker sends some of the newly unlocked rswETH to the maker as a payment for services, keeping the remainder for themselves.

Functionally, this allows Ion users to deleverage their position using only their unlocked collateral for payment, greatly improving UX.

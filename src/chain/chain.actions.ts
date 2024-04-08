import { JsonRpcSigner } from '@ethersproject/providers';
import { ERC20__factory } from '../abi';
import {
  STAKING_ADDRESSES,
  signSeaportOrderComponents,
} from '../seaport/seaport.utils';
import { BigNumber } from 'ethers';
import { TakerProvider } from '../events/events.taker-provider';
import { SeaportOrderComponents } from '../seaport/seaport.types';

export const approveAmount = async ({
  signer,
  tokenAddress,
  amount,
}: {
  signer: JsonRpcSigner;
  tokenAddress: string;
  amount: BigNumber;
}) => {
  const assetInstance = ERC20__factory.connect(tokenAddress, signer);
  return assetInstance.approve(STAKING_ADDRESSES.seaportConduit, amount);
};

export const acceptOrder = async ({
  signer,
  seaportOrderComponents,
  provider,
  quoteId,
}: {
  signer: JsonRpcSigner;
  seaportOrderComponents: SeaportOrderComponents;
  provider: TakerProvider;
  quoteId: number;
}) => {
  const signature = await signSeaportOrderComponents(
    signer,
    seaportOrderComponents
  );
  provider.acceptQuote({
    quoteId,
    components: seaportOrderComponents,
    signature,
  });
};

export const signAuthMessage = async (signer: JsonRpcSigner) => {
  const address = await signer.getAddress();
  // All properties on a domain are optional
  const domain = {
    name: 'hourglass',
    version: '1.0',
  };

  // The named list of all type definitions
  const types = {
    // EIP712Domain: [
    //   {
    //     name: "name",
    //     type: "string",
    //   },
    //   {
    //     name: "version",
    //     type: "string",
    //   },
    // ],
    AuthMessage: [
      {
        name: 'address',
        type: 'address',
      },
    ],
  };

  // The data to sign
  const message = { address };
  const signature = await signer._signTypedData(domain, types, message);
  return signature;
};

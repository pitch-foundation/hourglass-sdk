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
  spender = STAKING_ADDRESSES.seaportConduit,
}: {
  signer: JsonRpcSigner;
  tokenAddress: string;
  amount: BigNumber;
  spender?: string;
}) => {
  const erc20 = ERC20__factory.connect(tokenAddress, signer);
  return erc20.approve(spender, amount);
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

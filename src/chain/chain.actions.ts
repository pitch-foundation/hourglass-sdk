import { JsonRpcSigner } from '@ethersproject/providers';
import { ERC20__factory } from '../abi';
import { HOURGLASS_SEAPORT_ADDRESSES } from '../seaport/seaport.utils';
import { BigNumber } from 'ethers';

/**
 * Approve the seaport contract to spend ERC20 tokens from `tokenAddress`.
 */
export const approveAmount = async ({
  signer,
  tokenAddress,
  amount,
  spender = HOURGLASS_SEAPORT_ADDRESSES.seaportConduit,
}: {
  signer: JsonRpcSigner;
  tokenAddress: string;
  amount: BigNumber;
  spender?: string;
}) => {
  const erc20 = ERC20__factory.connect(tokenAddress, signer);
  return erc20.approve(spender, amount);
};

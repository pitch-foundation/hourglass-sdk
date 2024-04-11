import { JsonRpcSigner } from '@ethersproject/providers';
import { ERC20__factory } from '../abi';
import { STAKING_ADDRESSES } from '../seaport/seaport.utils';

export const getBalanceAndAllowance = async (
  signer: JsonRpcSigner,
  tokenAddress: string,
  spender = STAKING_ADDRESSES.seaportConduit
) => {
  const signerAddress = await signer.getAddress();
  const erc20 = ERC20__factory.connect(tokenAddress, signer);
  const [assetBalance, assetAllowance] = await Promise.all([
    erc20.balanceOf(signerAddress),
    erc20.allowance(signerAddress, spender),
  ]);
  return {
    assetBalance,
    assetAllowance,
  };
};

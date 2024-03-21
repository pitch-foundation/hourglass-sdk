import { JsonRpcSigner } from '@ethersproject/providers';
import { ERC20__factory } from '../abi';
import { STAKING_ADDRESSES } from '../seaport/seaport.utils';

export const getBalance = async (
  signer: JsonRpcSigner,
  tokenAddress: string
) => {
  const signerAddress = await signer.getAddress();
  const assetInstance = ERC20__factory.connect(tokenAddress, signer);
  const assetBalance = await assetInstance.balanceOf(signerAddress);
  const assetAllowance = await assetInstance.allowance(
    signerAddress,
    STAKING_ADDRESSES.seaportConduit
  );
  return {
    assetBalance,
    assetAllowance,
  };
};

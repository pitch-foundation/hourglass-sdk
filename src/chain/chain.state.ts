import { JsonRpcSigner } from '@ethersproject/providers';
import { ERC20__factory } from '../abi/index.js';
import { HOURGLASS_SEAPORT_ADDRESSES } from '../seaport/seaport.utils.js';

/**
 * Get the balance and allowance of an ERC20 token.
 * The default spender is the seaport conduit.
 */
export const getBalanceAndAllowance = async (
  signer: JsonRpcSigner,
  tokenAddress: string,
  spender = HOURGLASS_SEAPORT_ADDRESSES.seaportConduit
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

import { JsonRpcSigner } from '@ethersproject/providers';
import { ERC20__factory } from '../abi/index.js';
import { HOURGLASS_SEAPORT_ADDRESSES } from '../seaport/seaport.utils.js';

/**
 * Get the balance and allowance of an ERC20 token. The default spender is the seaport conduit.
 *
 * @param {JsonRpcSigner} signer - The signer to sign the components with.
 * @param {string} tokenAddress - The address of the token to get the balance and allowance of.
 * @param {string} spender - The address of the spender to get the allowance for.
 *
 * @category Chain
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

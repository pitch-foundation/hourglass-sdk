import { JsonRpcSigner } from '@ethersproject/providers';
import { ERC20__factory } from '../abi/index.js';
import { HOURGLASS_SEAPORT_ADDRESSES } from '../seaport/seaport.utils.js';
import { BigNumber } from 'ethers';

/** Input arguments for {@link approveAmount}.
 *
 * @property {JsonRpcSigner} signer - The signer to approve the amount for.
 * @property {string} tokenAddress - The address of the token to approve.
 * @property {BigNumber} amount - The amount to approve.
 * @property {string} spender - The address of the spender to approve the amount for.
 * @interface
 */
export interface ApproveAmountArgs {
  signer: JsonRpcSigner;
  tokenAddress: string;
  amount: BigNumber;
  spender?: string;
}

/**
 * Approve the seaport contract to spend ERC20 tokens from `tokenAddress`.
 *
 * @param {ApproveAmountArgs} args - Input args.
 *
 * @category Chain
 */
export const approveAmount = async ({
  signer,
  tokenAddress,
  amount,
  spender = HOURGLASS_SEAPORT_ADDRESSES.seaportConduit,
}: ApproveAmountArgs) => {
  const erc20 = ERC20__factory.connect(tokenAddress, signer);
  return erc20.approve(spender, amount);
};

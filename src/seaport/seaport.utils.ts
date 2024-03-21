import { Seaport } from '@opensea/seaport-js';
import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';
import {
  CROSS_CHAIN_SEAPORT_V1_5_ADDRESS,
  EIP_712_ORDER_TYPE,
  SEAPORT_CONTRACT_NAME,
  SEAPORT_CONTRACT_VERSION_V1_5,
} from '@opensea/seaport-js/lib/constants';
import { MulticallWrapper } from 'ethers-multicall-provider';
import { ethers } from 'ethers';
import { keccak256 } from 'ethers/lib/utils';
import { GnosisSafe1_3__factory, SeaportV5__factory } from '../abi';
import { OrderComponentsStruct } from '../abi/SeaportV5';

// globalThis.Buffer = Buffer;

export const STAKING_ADDRESSES = {
  seaportRollingZone: '0x67b14Fb1876901102f3fAA4dFB958e3C63b4AA1a',
  seaportConduit: '0x9352dA82F42c5bDDe9F0b2C19D635baE39142dD8',
  seaportConduitKey:
    '0xa8c94ae38b04140794a9394b76ac6d0a83ac0b02000000000000000000000000',
};

export const SEAPORT_ORDER_TYPE = {
  FULL_OPEN: 0, // No partial fills, anyone can execute
  PARTIAL_OPEN: 1, // Partial fills supported, anyone can execute
  FULL_RESTRICTED: 2, // No partial fills, only offerer or zone can execute
  PARTIAL_RESTRICTED: 3, // Partial fills supported, only offerer or zone can execute
} as const;

export const getSeaport = async (signer: JsonRpcSigner) => {
  const seaport = new Seaport(signer, {
    seaportVersion: '1.5',
    conduitKeyToConduit: {
      [STAKING_ADDRESSES.seaportConduitKey]: STAKING_ADDRESSES.seaportConduit,
    },
  });

  return seaport;
};

export type AwaitedObject<T> = {
  [K in keyof T]: Awaited<T[K]>;
};

const getSeaportDomain = async (signer: JsonRpcSigner) => {
  const domain = {
    name: SEAPORT_CONTRACT_NAME,
    version: SEAPORT_CONTRACT_VERSION_V1_5,
    chainId: await MulticallWrapper.wrap(signer.provider)
      .getNetwork()
      .then(({ chainId }) => chainId),
    verifyingContract: CROSS_CHAIN_SEAPORT_V1_5_ADDRESS,
  };
  return domain;
};

const signSeaportOrder = async (
  signer: JsonRpcSigner,
  components: AwaitedObject<OrderComponentsStruct>
) => {
  const domain = await getSeaportDomain(signer);
  const signatureFull = await signer._signTypedData(
    domain,
    EIP_712_ORDER_TYPE,
    components
  );
  return signatureFull;
};

const validateSignature = async (
  digest: string,
  signature: string,
  expectedSigner: string
) => {
  const recoveredSigner = ethers.utils.recoverAddress(digest, signature);
  if (expectedSigner !== recoveredSigner) throw new Error('Signer mismatch');
};

const computeDigestEip712 = (domainSeparator: string, orderHash: string) => {
  return keccak256(`0x1901${domainSeparator.slice(2)}${orderHash.slice(2)}`);
};

export const signSeaportOrderComponents = async (
  signer: JsonRpcSigner,
  components: AwaitedObject<OrderComponentsStruct>,
  isGnosis: boolean
) => {
  // Retrieved from etherscan by calling the information function on seaport 1.5
  // https://etherscan.io/address/0x00000000000000adc04c56bf30ac9d3c0aaf14dc#readContract
  const multiProvider = MulticallWrapper.wrap(signer.provider);

  const seaportV5 = SeaportV5__factory.connect(
    CROSS_CHAIN_SEAPORT_V1_5_ADDRESS,
    multiProvider.getSigner()
  );
  const orderHash = await seaportV5.getOrderHash(components);
  const signatureFull = await signSeaportOrder(signer, components);
  const domainSeparatorSeaport =
    '0x0d725b53ccd7c23735755082eee9d43d3add450d3564ad51af0d29aa16eeab3c';

  if (!isGnosis) {
    // EOA signature, returns compact signature
    const signatureCompact = ethers.utils.splitSignature(signatureFull).compact;
    // EIP 712 Signature
    const digest = computeDigestEip712(domainSeparatorSeaport, orderHash);
    await validateSignature(digest, signatureCompact, components.offerer);
    return signatureCompact;
  } else {
    // const signatureCompact = await signSeaportOrder(signer, components);
    const validLength =
      signatureFull.length >= 132 && (signatureFull.length - 2) % 130 === 0;
    if (!validLength) throw new Error('Invalid signature length');
    const numSigs = (signatureFull.length - 2) / 130;
    if (numSigs > 3) {
      throw new Error(
        'Too many signatures. Currently only 3 signatures are supported'
      );
    }
    const gnosisSafe = GnosisSafe1_3__factory.connect(
      components.offerer,
      signer.provider
    );
    const seaportDigestEip712 = computeDigestEip712(
      domainSeparatorSeaport,
      orderHash
    );
    const domainSeparatorGnosis = await gnosisSafe.domainSeparator();
    // Typehash for SafeMessage(bytes message) is the result of the following solidity operation.
    // keccak256(
    //    "SafeMessage(bytes message)"
    // );
    const gnosisSafeTypeHash =
      '0x60b3cbf8b4a223d68d641b3b6ddf9a298e7f33710cf3d3a9d1146b5a6150fbca';
    const gnosisSafeDataHash = keccak256(
      '0x' +
        [
          gnosisSafeTypeHash.slice(2),
          keccak256(seaportDigestEip712).slice(2),
        ].join('')
    );
    const gnosisSafeDigestEip712 = computeDigestEip712(
      domainSeparatorGnosis,
      gnosisSafeDataHash
    );

    await gnosisSafe.checkSignatures(
      gnosisSafeDigestEip712,
      seaportDigestEip712,
      signatureFull
    );
    // TODO: Copy signature validation logic from the backend

    return signatureFull;
  }

  // EIP 712 Signature
  // const digest = keccak256(`0x1901${domainSeparator.slice(2)}${orderHash.slice(2)}`);
  // await validateSignature(digest, signatureCompact, components.offerer);
  // return signatureCompact;
};

export const getWalletSignerAddressBlockNonce = async (
  userWalletProvider: JsonRpcProvider,
  signer: JsonRpcSigner
) => {
  const [signerAddress, block, nonce] = await Promise.all([
    signer.getAddress(),
    userWalletProvider.getBlock('latest'),
    signer.getTransactionCount(),
  ]);
  return { signer, signerAddress, block, nonce };
};

import { type Config, getClient, getConnectorClient } from '@wagmi/core';
import { providers } from 'ethers';
import type { Client, Chain, Transport, Account } from 'viem';

/**
 * Returns an ethers.js Provider from a Viem Client.
 *
 * @param {Client<Transport, Chain>} client - Viem client.
 *
 * @category Chain
 */
export function clientToProvider(client: Client<Transport, Chain>) {
  const { chain, transport } = client;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  if (transport.type === 'fallback') {
    return;
    // return new providers.FallbackProvider(
    //   (transport.transports as ReturnType<Transport>[]).map(
    //     ({ value }) => new providers.JsonRpcProvider(value?.url, network)
    //   )
    // );
  }
  return new providers.JsonRpcProvider(transport.url, network);
}

/**
 * Returns an ethers.js Provider from a Wagmi config.
 *
 * @param {Config} config - Wagmi config.
 * @param {number} chainId - Chain ID.
 *
 * @category Chain
 */
export function getEthersProvider(config: Config, chainId?: number) {
  const client = getClient(config, { chainId });
  if (!client) return;
  return clientToProvider(client);
}

/**
 * Returns an ethers.js Signer from a Viem Client.
 *
 * @param {Client<Transport, Chain, Account>} client - Viem client.
 *
 * @category Chain
 */
export function clientToSigner(client: Client<Transport, Chain, Account>) {
  const { account, chain, transport } = client;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new providers.Web3Provider(transport, network);
  const signer = provider.getSigner(account.address);
  return signer;
}

/**
 * Returns an ethers.js Signer from a Wagmi config.
 *
 * @param {Config} config - Wagmi config.
 * @param {number} chainId - Chain ID.
 *
 * @category Chain
 */
export async function getEthersSigner(config: Config, chainId?: number) {
  const client = await getConnectorClient(config, { chainId });
  return clientToSigner(client);
}

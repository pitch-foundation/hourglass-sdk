import { Socket } from 'socket.io-client';
import {
  DataEventsMap,
  DataMethod,
  PayloadHgGetMarkets,
  PayloadMessage,
} from './providers.types.js';
import { BaseProvider } from './providers.utils.js';

/** Input arguments for {@link DataProvider.connect}.
 *
 * @property {string} serverUrl - The base url of the server to connect to.
 * @interface
 */
export interface DataProviderConnectArgs {
  serverUrl: string;
}

/**
 * The `DataProvider` facilitates interactions with the Hourglass RFQ system `/data` namespace.
 *
 * The `/data` namespaces enables clients to query information about the Hourglass RFQ system.
 * The current set of supported actions is:
 * - Query markets (see {@link DataProvider.getMarkets})
 *
 * This class extends an event emitter and proxies events from the underlying websocket to
 * itself so that SDK consumers can listen for events without managing the websocket.
 *
 * @example
 * ```typescript
 * const dataProvider = new DataProvider();
 * ```
 */
export class DataProvider extends BaseProvider<
  DataEventsMap,
  DataMethod,
  null
> {
  protected setupListeners(socket: Socket) {
    socket.on('message', (data: PayloadMessage) => {
      const msg = this.findMessage(data.id);
      if (!msg) return;
      switch (msg.method) {
        case DataMethod.hg_getMarkets:
          this.emit(
            DataMethod.hg_getMarkets,
            data.result as PayloadHgGetMarkets | undefined,
            data.error
          );
          break;
        default: {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const _exhaustiveCheck: never = msg.method;
          this.log(`Found incoming message but method unknown: ${msg.method}`);
        }
      }
    });
  }

  /*//////////////////////////////////////////////////////////////
                              CONNECT
    //////////////////////////////////////////////////////////////*/

  /**
   * Establishes a connection to the websocket server for the `/data` namespace.
   *
   * @param {DataProviderConnectArgs} args - Input args.

   * @example
   * ```typescript
   * import { SERVER_URL_STAGING } from '@hourglass/sdk';
   *
   * dataProvider.connect({ serverUrl: SERVER_URL_STAGING });
   * dataProvider.on('connect', () => {
   *  console.log("Successfully connected to the server");
   * })
   * dataProvider.on('connect_error', (error) => {
   *  console.error(`Failed to connect to the server: ${error.message}`);
   * })
   * dataProvider.on('disconnect', (reason, description) => {
   *  console.log(`Disconnected from the server: ${reason}`);
   * })
   * ```
   * @category Connect
   */
  connect({ serverUrl }: DataProviderConnectArgs) {
    super.connectEntrypoint({
      endpoint: new URL('data', serverUrl).toString(),
      auth: null,
    });
  }

  /*//////////////////////////////////////////////////////////////
                              ACTIONS
    //////////////////////////////////////////////////////////////*/

  /**
   * Query the list of supported markets.
   *
   * - This method triggers the emission of a 'message' event to the server.
   * - The listener for event {@link DataMethod.hg_getMarkets} will receive the response.
   * - If successful, the type of the response object will be {@link PayloadHgGetMarkets}.
   *
   * @example
   * ```typescript
   *  dataProvider.getMarkets();
   *  dataProvider.on(DataMethod.hg_getMarkets, (data: PayloadHgGetMarkets, err) => {
   *    // Check for error and handle response if successful
   *  });
   * ```
   * @category Actions
   */
  getMarkets() {
    this.log('Requesting markets');
    this.emitMessage(DataMethod.hg_getMarkets, {});
  }
}

import { Socket } from 'socket.io-client';
import {
  DataEventsMap,
  DataMethod,
  PayloadHgGetMarkets,
  PayloadMessage,
} from './events.types.js';
import { BaseProvider } from './events.utils.js';

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
            data.result as PayloadHgGetMarkets,
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
   * Establishes a connection to the websocket server.
   *
   * @param {Object} params - Connection options.
   * @param {string} params.endpoint - The endpoint to connect to.
   *
   * @example
   * ```typescript
   * connect({ endpoint: 'ws://localhost:3100/taker' });
   * ```
   */
  connect({ endpoint }: { endpoint: string }) {
    super.connectEntrypoint({ endpoint, auth: null });
  }

  /*//////////////////////////////////////////////////////////////
                              ACTIONS
    //////////////////////////////////////////////////////////////*/

  /**
   * Query the list of supported markets.
   *
   * This method triggers the emission of a 'message' event to the server.
   * The listener for the `DataMethod.hg_getMarkets` will receive the response.
   * - If successful, the type of the response object will be `PayloadHgGetMarkets`.
   *
   * @example
   * ```typescript
   *  dataProvider.getMarkets();
   *  dataProvider.on(DataMethod.hg_getMarkets, (data: PayloadHgGetMarkets, err) => {
   *    // Check for error and handle response if successful
   *  });
   * ```
   */
  getMarkets() {
    this.log('Requesting markets');
    this.emitMessage(DataMethod.hg_getMarkets, {});
  }
}

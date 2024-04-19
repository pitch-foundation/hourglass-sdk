import { Socket } from 'socket.io-client';
import { DataEventsMap, DataMethod, PayloadMessage } from './events.types.js';
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
      if (Object.values(DataMethod).includes(msg.method)) {
        this.emit(msg.method, data.result, data.error);
      } else {
        this.log(`Found incoming message but method unknown: ${msg.method}`);
      }
    });
  }

  /*//////////////////////////////////////////////////////////////
                              CONNECT
    //////////////////////////////////////////////////////////////*/

  /**
   * Connect to the websocket server.
   */
  connect({ endpoint }: { endpoint: string }) {
    super.connectEntrypoint({ endpoint, auth: null });
  }

  /*//////////////////////////////////////////////////////////////
                              ACTIONS
    //////////////////////////////////////////////////////////////*/

  /**
   * Request the list of markets from the server. Listen for the
   * `DataMethod.hg_getMarkets` event to get the list of markets.
   */
  requestMarkets() {
    this.log('Requesting markets');
    this.emitMessage(DataMethod.hg_getMarkets, {});
  }
}

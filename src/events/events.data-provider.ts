import { Socket } from 'socket.io-client';
import { DataEventsMap, DataMethod, PayloadMessage } from './events.types';
import { BaseProvider, ReconnectionState } from './events.utils';

export class DataProvider extends BaseProvider<
  DataEventsMap,
  DataMethod,
  null
> {
  setupListeners(socket: Socket, rs: ReconnectionState) {
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

  connect({ endpoint }: { endpoint: string }) {
    super.connectEntrypoint({ endpoint, auth: null });
  }

  /*//////////////////////////////////////////////////////////////
                              ACTIONS
    //////////////////////////////////////////////////////////////*/

  requestMarkets() {
    this.log('Requesting markets');
    this.emitMessage(DataMethod.hg_getMarkets, {});
  }
}

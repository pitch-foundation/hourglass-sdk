import { DataEventsMap, DataMethod, PayloadMessage } from './events.types';
import { BaseProvider } from './events.utils';

export class DataProvider extends BaseProvider<
  DataEventsMap,
  DataMethod,
  null
> {
  /*//////////////////////////////////////////////////////////////
                              CONNECT
    //////////////////////////////////////////////////////////////*/

  connect(endpoint: string) {
    super.connectEntrypoint(endpoint, null);
    if (!this.socket) {
      return;
    }

    this.socket.on('message', (data: PayloadMessage) => {
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
                              ACTIONS
    //////////////////////////////////////////////////////////////*/

  requestMarkets() {
    this.log('Requesting markets');
    this.emitMessage(DataMethod.hg_getMarkets, {});
  }
}

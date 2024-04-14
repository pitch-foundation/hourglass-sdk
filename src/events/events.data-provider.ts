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
      const { result, error } = data;
      switch (msg?.method) {
        case DataMethod.hg_getMarkets:
          this.emit(DataMethod.hg_getMarkets, result, error);
          break;
        default:
          break;
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

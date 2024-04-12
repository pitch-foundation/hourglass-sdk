import { Socket, io } from 'socket.io-client';
import {
  DataEventsMap,
  DataMethod,
  JsonRpcMessage,
  PayloadMessage,
  ProviderConstructorArgs,
  WebsocketConnectOptions,
} from './events.types';
import {
  createMessage,
  getProviderDefaultArgs,
  TypedEventEmitter,
} from './events.utils';

// ====================================================================
// New implementation leveraging a factory with a generic class
// ====================================================================

// export class DataProvider extends ProviderBaseFactory<
//   DataEventsMap,
//   DataMethod
// >() {
//   /*//////////////////////////////////////////////////////////////
//                               CONNECT
//     //////////////////////////////////////////////////////////////*/
//   connect(endpoint: string) {
//     // Creates the socket, set's up listeners for socket.io events.
//     super.connect(endpoint);
//     if (!this._socket) {
//       return;
//     }

//     // ====================================================================
//     // message event
//     // ====================================================================
//     this._socket.on('message', (data: PayloadMessage) => {
//       const request = this._findMessage(data.id);
//       if (!request) {
//         this._log(`Unable to locate request for message id: ${data.id}`);
//         return;
//       } else {
//         this._log(
//           `Located response for | message: ${request.id} | method: ${
//             request.method
//           } | data: ${JSON.stringify(data)}`
//         );
//       }

//       const { result, error } = data;
//       switch (request?.method) {
//         case DataMethod.hg_getMarkets:
//           this.emit(DataMethod.hg_getMarkets, result, error);
//           break;
//         default:
//           break;
//       }
//     });
//   }

//   /*//////////////////////////////////////////////////////////////
//                               ACTIONS
//     //////////////////////////////////////////////////////////////*/

//   requestMarkets() {
//     this._log('Requesting markets');
//     this._emitMessage(DataMethod.hg_getMarkets, {});
//   }
// }

// ====================================================================
// Old implementation leveraging a factory with a generic class
// ====================================================================

export class DataProvider extends TypedEventEmitter<DataEventsMap> {
  private _socket: Socket | undefined;
  private _globalMessages: JsonRpcMessage<DataMethod>[] = [];
  private _logger?: (message: string) => void;
  private _connectOpts: WebsocketConnectOptions;
  private _retries = 0;
  private _retryDelay: number;
  private _maxRetries: number;
  private _connectionStabilityThreshold: number;
  private _connectionStableTimer?: ReturnType<typeof setTimeout>;

  constructor(args: ProviderConstructorArgs) {
    super();
    const {
      logger,
      connectOpts,
      retryDelay,
      maxRetries,
      connectionStabilityThreshold,
    } = getProviderDefaultArgs(args);
    this._logger = logger;
    this._connectOpts = connectOpts;
    this._retryDelay = retryDelay;
    this._maxRetries = maxRetries;
    this._connectionStabilityThreshold = connectionStabilityThreshold;
  }

  private _log(msg: string) {
    this._logger?.(`[DataProvider] ${msg}`);
  }

  private _emitMessage(method: DataMethod, params: unknown) {
    if (!this._socket) {
      this._log('Data socket not connected. Cannot send message');
      return;
    }
    const message = createMessage(method, params);
    this._globalMessages.push(message);
    this._log(`Emitting message: ${JSON.stringify(message)}`);
    this._socket.emit('message', message);
  }

  private _findMessage(id: string) {
    return this._globalMessages.find((m) => m.id === id);
  }

  /*//////////////////////////////////////////////////////////////
                              CONNECT
    //////////////////////////////////////////////////////////////*/

  connect(endpoint: string) {
    this._socket = io(endpoint, {
      ...this._connectOpts,
      transports: ['websocket'],
    });

    // ====================================================================
    // message event
    // ====================================================================
    this._socket.on('message', (data: PayloadMessage) => {
      const request = this._findMessage(data.id);
      if (!request) {
        this._log(`Unable to locate request for message id: ${data.id}`);
        return;
      } else {
        this._log(
          `Located response for | message: ${request.id} | method: ${
            request.method
          } | data: ${JSON.stringify(data)}`
        );
      }

      const { result, error } = data;
      switch (request?.method) {
        case DataMethod.hg_getMarkets:
          this.emit(DataMethod.hg_getMarkets, result, error);
          break;
        default:
          break;
      }
    });

    // ====================================================================
    // Socket.io events
    // ====================================================================
    this._socket.on('connect', () => {
      this._log('Connected to server');
      this.emit('connect');

      this._connectionStableTimer = setTimeout(() => {
        this._log('Connection deemed stable. Resetting retry counter.');
        this._retries = 0;
      }, this._connectionStabilityThreshold);
    });

    this._socket.on('connect_error', (error) => {
      this._log('Connection error');
      this.emit('connect_error', error);
    });

    this._socket.on('disconnect', (reason, description) => {
      this._log(`Disconnected: ${reason} - ${description}`);
      this.emit('disconnect', reason, description);

      if (this._connectionStableTimer) {
        clearTimeout(this._connectionStableTimer);
        this._connectionStableTimer = undefined;
      }
      // Attempt to reconnect
      if (this._retries > this._maxRetries) {
        this._log('Max retries reached. Stopping reconnect attempts');
        return;
      }
      setTimeout(() => {
        this._retries++;
        this.connect(endpoint);
      }, Math.pow(2, this._retries) * this._retryDelay);
    });
  }

  /*//////////////////////////////////////////////////////////////
                              ACTIONS
    //////////////////////////////////////////////////////////////*/

  requestMarkets() {
    this._log('Requesting markets');
    this._emitMessage(DataMethod.hg_getMarkets, {});
  }
}

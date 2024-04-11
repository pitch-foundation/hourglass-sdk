import { io, Socket } from 'socket.io-client';
import {
  DataEventsMap,
  DataMethod,
  JsonRpcMessage,
  PayloadMessage,
  WebsocketConnectOptions,
} from './events.types';
import { createMessage, TypedEventEmitter } from './events.utils';

export class DataProvider extends TypedEventEmitter<DataEventsMap> {
  private _socket: Socket | undefined;
  private _globalMessages: JsonRpcMessage<DataMethod>[] = [];
  private _logger?: (message: string) => void;
  private _connectOpts: WebsocketConnectOptions;

  constructor({
    logger,
    debug,
    connectOpts,
  }: {
    logger?: (message: string) => void;
    debug?: boolean;
    connectOpts?: WebsocketConnectOptions;
  }) {
    super();
    if (debug) this._logger = logger ?? console.log;
    this._connectOpts = connectOpts ?? {};
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
    });

    this._socket.on('connect_error', (error) => {
      this._log('Connection error');
      this.emit('connect_error', error);
    });

    this._socket.on('disconnect', (reason, description) => {
      this._log(`Disconnected: ${reason} - ${description}`);
      this.emit('disconnect', reason, description);
      // Attempt to reconnect
      this.connect(endpoint);
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

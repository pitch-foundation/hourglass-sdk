import { createMessage, TypedEventEmitter } from './events.utils';
import { io, Socket } from 'socket.io-client';
import {
  TakerMethod,
  HourglassWebsocketEvent,
  TakerEventsMap,
  UseCase,
  OrderExecutor,
  TakerSource,
  WebsocketConnectOptions,
  TakerAuth,
} from './events.types';
import { SeaportOrderComponents } from '../seaport/seaport.types';

export class TakerProvider extends TypedEventEmitter<TakerEventsMap> {
  private _socket: Socket | undefined;
  private _accessToken: string | undefined;
  private _globalMessages: {
    id: string;
    method: TakerMethod;
    accessToken: string;
  }[] = [];
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
    this._logger?.(`[TakerProvider] ${msg}`);
  }

  private _emitMessage(method: TakerMethod, params: unknown) {
    if (!this._socket) {
      this._log('Taker socket not connected. Cannot send message');
      return;
    }
    if (!this._accessToken) {
      this._log('Access token not set. Cannot send message');
      return;
    }
    const message = createMessage(method, params);
    this._globalMessages.push({
      id: message.id,
      method: message.method,
      accessToken: this._accessToken,
    });
    this._log(`Emitting message: ${JSON.stringify(message)}`);
    this._socket.emit('message', message);
  }

  private _findMessage(id: string) {
    return this._globalMessages.find((m) => m.id === id);
  }

  /*//////////////////////////////////////////////////////////////
                              CONNECT
    //////////////////////////////////////////////////////////////*/

  connect({ auth, endpoint }: { auth: TakerAuth; endpoint: string }) {
    // If user passes in an external access token, they are reconnecting to a session
    if (auth.token) this._accessToken = auth.token;
    this._log(`Connecting to ${endpoint} with auth: ${JSON.stringify(auth)}`);
    this._socket = io(endpoint, {
      ...this._connectOpts,
      transports: ['websocket'],
      auth,
      // TODO: autoConnect: false ? This is true in the maker provider
    });

    this._socket.on(
      HourglassWebsocketEvent.AccessToken,
      (data: { accessToken: string }, callback: (value: string) => void) => {
        callback('ACK');
        this._log(`Received access token: ${data.accessToken}`);
        this._accessToken = data.accessToken;
        this.emit(HourglassWebsocketEvent.AccessToken, data, undefined);
      }
    );

    this._socket.on(
      HourglassWebsocketEvent.BestQuote,
      (data: any, callback: (value: string) => void) => {
        this._log(`Received best quote: ${JSON.stringify(data)}`);
        this.emit(HourglassWebsocketEvent.BestQuote, data, undefined);
        callback('ACK');
      }
    );

    this._socket.on(
      HourglassWebsocketEvent.OrderFulfilled,
      (data: any, callback: (value: string) => void) => {
        this._log(`Received order fulfilled: ${JSON.stringify(data)}`);
        this.emit(HourglassWebsocketEvent.OrderFulfilled, data, undefined);
        callback('ACK');
      }
    );

    this._socket.on(
      HourglassWebsocketEvent.OrderCreated,
      (data: any, callback: (value: string) => void) => {
        this._log(`Received order created: ${JSON.stringify(data)}`);
        this.emit(HourglassWebsocketEvent.OrderCreated, data, undefined);
        callback('ACK');
      }
    );

    this._socket.on(
      'message',
      (data: { id: string; result: any; error: any }) => {
        const request = this._findMessage(data.id);
        if (!request) {
          this._log(`Unable to locate request for message id: ${data.id}`);
        } else {
          this._log(
            `Located response for | message: ${request.id} | method: ${
              request.method
            } | data: ${JSON.stringify(data)}`
          );
        }

        const { result, error } = data;
        switch (request?.method) {
          case TakerMethod.hg_requestQuote:
            this.emit(TakerMethod.hg_requestQuote, data.result, data.error);
            break;
          case TakerMethod.hg_acceptQuote:
            this.emit(TakerMethod.hg_acceptQuote, data.result, data.error);
            break;
          default:
            break;
        }
      }
    );

    this._socket.on('connect', () => {
      this._log('Connected to taker socket');
      this.emit('connect');
    });

    this._socket.on('connect_error', (error) => {
      this._log(`Connection error: ${error}`);
      this.emit('connect_error', error);
    });

    this._socket.on('disconnect', (reason, description) => {
      this._log(`Disconnected: ${reason} - ${description}`);
      this.emit('disconnect', reason, description);
      this.connect({
        // When reconnecting, we use the most recent access token rather than the one within method scope.
        auth: { ...auth, token: this._accessToken },
        endpoint,
      });
    });
  }

  /*//////////////////////////////////////////////////////////////
                              ACTIONS
    //////////////////////////////////////////////////////////////*/

  requestQuote(data: {
    baseAssetAddress: string;
    quoteAssetAddress: string;
    baseAssetChainId: number;
    quoteAssetChainId: number;
    baseAmount?: string;
    quoteAmount?: string;
    quoteAssetReceiverAddress?: string;
    executor: OrderExecutor;
    useCase?: UseCase;
    useCaseMetadata?: Record<string, any>;
  }) {
    this._log(`Requesting quote: ${JSON.stringify(data)}`);
    this._emitMessage(TakerMethod.hg_requestQuote, data);
  }

  acceptQuote(data: {
    quoteId: number;
    components?: SeaportOrderComponents;
    signature?: string;
  }) {
    this._log(`Accepting quote: ${JSON.stringify(data)}`);
    this._emitMessage(TakerMethod.hg_acceptQuote, data);
  }
}

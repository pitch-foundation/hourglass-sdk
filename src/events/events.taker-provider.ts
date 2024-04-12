import { io, Socket } from 'socket.io-client';
import { SeaportOrderComponents } from '../seaport/seaport.types';
import {
  ExecutorAndQuoteAssetReceiver,
  JsonRpcMessage,
  PayloadAccessToken,
  PayloadBestQuote,
  PayloadMessage,
  PayloadOrderCreated,
  PayloadOrderFulfilled,
  ProviderConstructorArgs,
  SocketOnCallback,
  TakerAuth,
  TakerEventsMap,
  TakerMethod,
  UseCase,
  WebsocketConnectOptions,
  WebsocketEvent,
} from './events.types';
import {
  createMessage,
  getProviderDefaultArgs,
  TypedEventEmitter,
} from './events.utils';

export class TakerProvider extends TypedEventEmitter<TakerEventsMap> {
  private _socket: Socket | undefined;
  private _accessToken: string | undefined;
  private _globalMessages: JsonRpcMessage<TakerMethod>[] = [];
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
      WebsocketEvent.AccessToken,
      (data: PayloadAccessToken, callback: SocketOnCallback) => {
        callback('ACK');
        this._log(`Received access token: ${data.accessToken}`);
        this._accessToken = data.accessToken;
        this.emit(WebsocketEvent.AccessToken, data, undefined);
      }
    );

    this._socket.on(
      WebsocketEvent.BestQuote,
      (data: PayloadBestQuote, callback: SocketOnCallback) => {
        this._log(`Received best quote: ${JSON.stringify(data)}`);
        this.emit(WebsocketEvent.BestQuote, data, undefined);
        callback('ACK');
      }
    );

    this._socket.on(
      WebsocketEvent.OrderFulfilled,
      (data: PayloadOrderFulfilled, callback: SocketOnCallback) => {
        this._log(`Received order fulfilled: ${JSON.stringify(data)}`);
        this.emit(WebsocketEvent.OrderFulfilled, data, undefined);
        callback('ACK');
      }
    );

    this._socket.on(
      WebsocketEvent.OrderCreated,
      (data: PayloadOrderCreated, callback: SocketOnCallback) => {
        this._log(`Received order created: ${JSON.stringify(data)}`);
        this.emit(WebsocketEvent.OrderCreated, data, undefined);
        callback('ACK');
      }
    );

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
        case TakerMethod.hg_requestQuote:
          this.emit(TakerMethod.hg_requestQuote, result, error);
          break;
        case TakerMethod.hg_acceptQuote:
          this.emit(TakerMethod.hg_acceptQuote, result, error);
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
        this.connect({
          // When reconnecting, we use the most recent access token rather than the one within method scope.
          auth: { ...auth, token: this._accessToken },
          endpoint,
        });
      }, Math.pow(2, this._retries) * this._retryDelay);
    });
  }

  /*//////////////////////////////////////////////////////////////
                              ACTIONS
    //////////////////////////////////////////////////////////////*/

  requestQuote(
    data: {
      baseAssetAddress: string;
      quoteAssetAddress: string;
      baseAssetChainId: number;
      quoteAssetChainId: number;
      baseAmount?: string;
      quoteAmount?: string;
      useCase?: UseCase;
      useCaseMetadata?: Record<string, any>;
    } & ExecutorAndQuoteAssetReceiver
  ) {
    if (
      (data.baseAmount && data.quoteAmount) ||
      (!data.baseAmount && !data.quoteAmount)
    ) {
      throw new Error('Must specify either baseAmount XOR quoteAmount.');
    }
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

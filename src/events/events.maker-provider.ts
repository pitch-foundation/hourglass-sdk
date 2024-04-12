import { io, Socket } from 'socket.io-client';
import {
  JsonRpcMessage,
  MakerAuth,
  MakerEventsMap,
  MakerMethod,
  PayloadAccessToken,
  PayloadMessage,
  PayloadOrderCreated,
  PayloadOrderFulfilled,
  PayloadQuoteAccepted,
  PayloadRequestForQuoteBroadcast,
  ProviderConstructorArgs,
  SocketOnCallback,
  WebsocketConnectOptions,
  WebsocketEvent,
} from './events.types';
import {
  createMessage,
  getProviderDefaultArgs,
  TypedEventEmitter,
} from './events.utils';

export class MakerProvider extends TypedEventEmitter<MakerEventsMap> {
  private _socket: Socket | undefined;
  private _accessToken: string | undefined;
  private _globalMessages: JsonRpcMessage<MakerMethod>[] = [];
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
    this._logger?.(`[MakerProvider] ${msg}`);
  }

  private _emitMessage(method: MakerMethod, params: unknown) {
    if (!this._socket) {
      this._log('Maker socket not connected. Cannot send message');
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

  connect({ auth, endpoint }: { auth: MakerAuth; endpoint: string }) {
    // If user passes in an external access token, they are reconnecting to a session
    if (auth.token) this._accessToken = auth.token;
    this._log(`Connecting to ${endpoint} with auth: ${JSON.stringify(auth)}`);

    this._socket = io(endpoint, {
      ...this._connectOpts,
      transports: ['websocket'],
      auth,
      autoConnect: false,
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
        case MakerMethod.hg_submitQuote:
          this.emit(MakerMethod.hg_submitQuote, result, error);
          break;
        case MakerMethod.hg_subscribeToMarket:
          this.emit(MakerMethod.hg_subscribeToMarket, result, error);
          break;
        case MakerMethod.hg_unsubscribeFromMarket:
          this.emit(MakerMethod.hg_unsubscribeFromMarket, result, error);
          break;
        default:
          break;
      }
    });

    this._socket.on(
      WebsocketEvent.OrderCreated,
      (data: PayloadOrderCreated, callback: SocketOnCallback) => {
        callback('ACK');
        this._log(`Received order created: ${JSON.stringify(data)}`);
        this.emit(WebsocketEvent.OrderCreated, data, undefined);
      }
    );

    this._socket.on(
      WebsocketEvent.OrderFulfilled,
      (data: PayloadOrderFulfilled, callback: SocketOnCallback) => {
        callback('ACK');
        this._log(`Received order fulfilled: ${JSON.stringify(data)}`);
        this.emit(WebsocketEvent.OrderFulfilled, data, undefined);
      }
    );

    this._socket.on(
      WebsocketEvent.QuoteAccepted,
      (data: PayloadQuoteAccepted, callback: SocketOnCallback) => {
        callback('ACK');
        this._log(`Received quote accepted: ${JSON.stringify(data)}`);
        this.emit(WebsocketEvent.QuoteAccepted, data, undefined);
      }
    );

    this._socket.on(
      WebsocketEvent.RequestForQuoteBroadcast,
      (data: PayloadRequestForQuoteBroadcast) => {
        // This event is emitted to all market makers within a market room. Since this is emitted to a room,
        // we don't need to ACK to the server.
        this._log(
          `Received request for quote broadcast: ${JSON.stringify(data)}`
        );
        this.emit(WebsocketEvent.RequestForQuoteBroadcast, data, undefined);
      }
    );

    // ====================================================================
    // Socket.io events
    // ====================================================================
    this._socket.on('connect', () => {
      this._log('Connected to server');
      this.emit('connect');

      // Start the connection stability timer
      this._connectionStableTimer = setTimeout(() => {
        this._log('Connection deemed stable. Resetting retry counter.');
        this._retries = 0; // Reset the retry counter if the connection is stable
      }, this._connectionStabilityThreshold);
    });

    this._socket.on('connect_error', (error) => {
      this._log('Connection error');
      this.emit('connect_error', error);
    });

    this._socket.on('disconnect', (reason, description) => {
      this._log(`Disconnected: ${reason} - ${description}`);
      this.emit('disconnect', reason, description);
      // Clear the stability timer if the connection drops before becoming stable
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

  submitQuote(data: {
    baseAmount?: string;
    quoteAmount?: string;
    rfqId: number;
  }) {
    if (
      (data.baseAmount && data.quoteAmount) ||
      (!data.baseAmount && !data.quoteAmount)
    ) {
      throw new Error('Must specify either baseAmount XOR quoteAmount.');
    }
    this._log(`Submitting quote: ${JSON.stringify(data)}`);
    this._emitMessage(MakerMethod.hg_submitQuote, data);
  }

  subscribeToMarket(data: { marketId: number }) {
    this._log(`Subscribing to market: ${JSON.stringify(data)}`);
    this._emitMessage(MakerMethod.hg_subscribeToMarket, data);
  }

  unsubscribeFromMarket(data: { marketId: number }) {
    this._log(`Unsubscribing from market: ${JSON.stringify(data)}`);
    this._emitMessage(MakerMethod.hg_unsubscribeFromMarket, data);
  }
}

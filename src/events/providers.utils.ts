import EventEmitter from 'events';
import { Socket, io } from 'socket.io-client';
import {
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY_MSECS,
} from './providers.constants.js';
import {
  DataEventsMap,
  DataMethod,
  JsonRpcMessage,
  AuthMakerApiUser,
  MakerEventsMap,
  MakerMethod,
  ProviderConstructorArgs,
  AuthTakerApiUser,
  TakerEventsMap,
  TakerMethod,
  WebsocketConnectOptions,
} from './providers.types.js';

export class TypedEventEmitter<TEvents extends Record<string, Array<unknown>>> {
  protected _emitter = new EventEmitter();

  protected emit<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    ...eventArgs: TEvents[TEventName]
  ) {
    this._emitter.emit(eventName, ...eventArgs);
  }

  /** Listen for event on event emitter.
   *
   * @category Events
   */
  on<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    handler: (...eventArgs: TEvents[TEventName]) => void
  ) {
    this._emitter.on(eventName, handler);
  }

  /** Stop listening for event on event emitter.
   *
   * @category Events
   */
  off<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    handler: (...eventArgs: TEvents[TEventName]) => void
  ) {
    this._emitter.off(eventName, handler);
  }
}

/** @internal */
export class ReconnectionState {
  retries: number;

  timeout: ReturnType<typeof setTimeout> | undefined;
  accessToken?: string;

  constructor(readonly retryDelayMsecs: number) {
    this.retries = 0;
    this.timeout = undefined;
  }

  reset() {
    this.retries = 0;
    this.clearReconnectTimeout();
  }

  clearReconnectTimeout() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  }

  setupReconnectTimeout(callback: (accessToken?: string) => void) {
    // Injects the most recent access token into the reconnect callback
    const delayMsecs = Math.pow(2, this.retries++) * this.retryDelayMsecs;
    console.log(`Reconnecting in ${delayMsecs / 1000} secs`);
    this.timeout = setTimeout(() => callback(this.accessToken), delayMsecs);
  }

  setAccessToken(token: string) {
    if (typeof token !== 'string') throw new Error('Invalid access token');
    this.accessToken = token;
  }
}

/**
 * @template TEvents - The event map for the provider.
 * @template TMethod - The method enum for the provider.
 * @template TAuth - The auth type for the provider.
 *
 * @
 */
export class BaseProvider<
  TEvents extends DataEventsMap | MakerEventsMap | TakerEventsMap,
  TMethod extends DataMethod | MakerMethod | TakerMethod,
  TAuth extends AuthMakerApiUser | AuthTakerApiUser | null
> extends TypedEventEmitter<TEvents> {
  private socket: Socket | undefined;
  private globalMessages: JsonRpcMessage<TMethod>[] = [];
  private logger?: (message: string) => void;
  private connectOpts: WebsocketConnectOptions;
  private retryDelayMsecs: number;
  private maxRetries: number;

  /**
   *
   * @param {ProviderConstructorArgs} [args] - Provider constructor args.
   * @category Initialization
   */
  constructor(args?: ProviderConstructorArgs) {
    super();
    const { logger, debug, connectOpts, retryDelayMsecs, maxRetries } =
      args ?? {};
    this.logger = debug ? logger ?? console.log : undefined;
    this.connectOpts = connectOpts ?? {};
    this.retryDelayMsecs = retryDelayMsecs ?? DEFAULT_RETRY_DELAY_MSECS;
    this.maxRetries = maxRetries ?? DEFAULT_MAX_RETRIES;
    this.log(`initialized | ${JSON.stringify(args)}`);
  }

  protected log(msg: string) {
    const parts = [this.constructor.name] as string[];
    if (this.socket?.id) {
      parts.push(`id: ${this.socket.id}`);
    }
    this.logger?.(`[${parts.join(' - ')}] ${msg}`);
  }

  protected emitMessage(method: TMethod, params: unknown) {
    if (!this.socket) {
      this.log('socket not connected. Cannot send message');
      return;
    }
    const message = {
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: crypto.randomUUID(),
    };
    this.globalMessages.push(message);
    this.log(`Emitting message: ${JSON.stringify(message)}`);
    this.socket.emit('message', message);
  }

  protected findMessage(id: string) {
    const msg = this.globalMessages.find((m) => m.id === id);
    if (!msg) {
      this.log(`Unable to locate request for message id: ${id}`);
      return null;
    }
    this.log(
      `Located response for | message: ${msg.id} | method: ${
        msg.method
      } | data: ${JSON.stringify(msg)}`
    );
    return msg;
  }

  // Must be overriden by subclasses. Should attach socket listeners that proxy to event emitter.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected setupListeners(socket: Socket, rs: ReconnectionState) {
    throw new Error('Method not implemented.');
  }

  /*//////////////////////////////////////////////////////////////
                                CONNECT
      //////////////////////////////////////////////////////////////*/

  private connectScoped(endpoint: string, auth: TAuth, rs: ReconnectionState) {
    // ----------------------------------------------------------------
    // 1. Teardown existing socket connection
    // ----------------------------------------------------------------
    if (this.socket !== undefined) {
      // There is existing socket connection
      if (this.socket.connected) {
        // Existing socket is connected, force disconnect
        this.log(
          `Disconnecting existing socket ${this.socket.id} to establish new connection.`
        );
        // When the 'disconnect' event is emitted, the the reason will be 'io client disconnect'
        // We check for this in the handler for this event and skip retries in this scenario.
        this.socket.disconnect();
      }
      this.socket.removeAllListeners();
      this.socket = undefined;
    }

    // ----------------------------------------------------------------
    // 2. Create new socket and setup listeners
    // ----------------------------------------------------------------

    // We store a local reference to the socket created within the scope of this `connectScoped` call.
    // The reason is that this.socket can be reassigned to a new socket in subsequent calls to `connectScoped`.
    // We want to reference the locally scoped socket within callbacks to avoid referencing the wrong socket.
    const socket = io(endpoint, {
      ...this.connectOpts,
      ...(auth ? { auth } : {}),
      transports: ['websocket'],
      autoConnect: true, // no need to manually call socket.connect()
      reconnection: false, // we set this to false as we manually handle reconnection behavior.
    });
    this.socket = socket;

    // ----------------------------------------------------------------
    // Listeners for socket.io events
    // ----------------------------------------------------------------

    const reconnect = () => {
      if (socket.connected) {
        // If this callback is somehow triggered but the socket is connected, we don't need to reconnect.
        rs.reset();
        return;
      }
      rs.clearReconnectTimeout();
      if (rs.retries >= this.maxRetries) {
        this.log('Max retries reached. Stopping reconnect attempts.');
        socket.removeAllListeners();
      } else {
        // Since `connectEntrypoint` returns the reconnection state object, subclasses
        // that extend this base class can interact with the reconnection state.
        // If the connection requires an access token, the subclass can set the
        // access token on the reconnection state object when an AccessToken event
        // is emitted. the reconnection state object will inject the current access
        // token (if one exists) into this callback when it is invoked. This enables
        // session re-establishment with the most recent access token.
        rs.setupReconnectTimeout((accessToken?: string) => {
          this.log(`retry attempt: ${rs.retries}`);
          if (auth && accessToken) {
            auth.token = accessToken;
          }
          this.connectScoped(endpoint, auth, rs);
        });
      }
    };

    socket.on('connect', () => {
      this.log(`Successfully connected to server ${endpoint}`);
      this.emit('connect');
      rs.reset();
    });

    socket.on('connect_error', (error) => {
      this.log('Connection error');
      this.emit('connect_error', error);
      reconnect();
    });

    socket.on('disconnect', (reason, description) => {
      this.log(
        `Disconnected: ${reason} - ${
          description ? JSON.stringify(description) : description
        }`
      );
      this.emit('disconnect', reason, description);

      // If we called socket.disconnect() explicitly, we don't want to reconnect
      if (reason === 'io client disconnect') {
        this.log(
          'Explicit disconnect on client side. Not trying to reconnect.'
        );
        rs.reset();
        return;
      }
      reconnect();
    });

    this.setupListeners(socket, rs);
  }

  protected connectEntrypoint({
    endpoint,
    auth,
  }: {
    endpoint: string;
    auth: TAuth;
  }) {
    // We store reconnection state in a separate instance of a utility class. The reason
    // we do this as opposed to storing this state on the instance is that sdk consumers
    // might call this method multiple times. We want to ensure that each call to connectEntrypoint
    // has it's own scoped state for reconnection attempts. Additionally, subclasses can
    // inject the most recent access token into the reconnection state object when an
    // AccessToken event is emitted. This enables session re-establishment.
    const rs = new ReconnectionState(this.retryDelayMsecs);
    this.connectScoped(endpoint, auth, rs);
  }
}

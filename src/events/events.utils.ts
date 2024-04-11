import EventEmitter from 'events';
import {
  DataEventsMap,
  DataMethod,
  JsonRpcMessage,
  MakerEventsMap,
  MakerMethod,
  ProviderConstructorArgs,
  TakerEventsMap,
  TakerMethod,
  WebsocketConnectOptions,
} from './events.types';
import { MAX_RETRY_ATTEMPTS, RETRY_DELAY } from './events.constants';
import { Socket, io } from 'socket.io-client';

export class TypedEventEmitter<TEvents extends Record<string, Array<any>>> {
  _emitter = new EventEmitter();

  emit<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    ...eventArg: TEvents[TEventName]
  ) {
    this._emitter.emit(eventName, ...eventArg);
  }

  on<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    handler: (...eventArg: TEvents[TEventName]) => void
  ) {
    this._emitter.on(eventName, handler);
  }

  off<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    handler: (...eventArg: TEvents[TEventName]) => void
  ) {
    this._emitter.off(eventName, handler);
  }
}

export function ProviderBaseFactory<
  TEvents extends DataEventsMap | MakerEventsMap | TakerEventsMap,
  TMethod extends DataMethod | MakerMethod | TakerMethod
>() {
  class BaseProvider extends TypedEventEmitter<TEvents> {
    _socket: Socket | undefined;
    _globalMessages: JsonRpcMessage<TMethod>[] = [];
    _logger?: (message: string) => void;
    _connectOpts: WebsocketConnectOptions;
    _retries = 0;
    _retryDelay: number;
    _maxRetries: number;

    constructor(args: ProviderConstructorArgs) {
      super();
      const { logger, connectOpts, retryDelay, maxRetries } =
        getProviderDefaultArgs(args);
      this._logger = logger;
      this._connectOpts = connectOpts;
      this._retryDelay = retryDelay;
      this._maxRetries = maxRetries;
    }

    _log(msg: string) {
      this._logger?.(`[${this.constructor.name}] ${msg}`);
    }

    _emitMessage(method: TMethod, params: unknown) {
      if (!this._socket) {
        this._log('Data socket not connected. Cannot send message');
        return;
      }
      const message = createMessage(method, params);
      this._globalMessages.push(message);
      this._log(`Emitting message: ${JSON.stringify(message)}`);
      this._socket.emit('message', message);
    }

    _findMessage(id: string) {
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
  }

  return BaseProvider;
}

export const createMessage = <M extends DataMethod | MakerMethod | TakerMethod>(
  method: M,
  params: any
): JsonRpcMessage<M> => {
  const uuid = crypto.randomUUID();
  const message = {
    jsonrpc: '2.0',
    method: method,
    params: params,
    id: uuid,
  };
  return message;
};

export const getProviderDefaultArgs = ({
  logger,
  debug,
  connectOpts,
  retryDelay,
  maxRetries,
}: ProviderConstructorArgs) => {
  return {
    logger: debug ? logger ?? console.log : undefined,
    debug: debug ?? false,
    connectOpts: connectOpts ?? {},
    retryDelay: retryDelay ?? RETRY_DELAY,
    maxRetries: maxRetries ?? MAX_RETRY_ATTEMPTS,
  };
};

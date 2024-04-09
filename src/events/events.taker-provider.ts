import { TypedEventEmitter } from './events.utils';
import { io, Socket } from 'socket.io-client';
import {
  TakerMethod,
  HourglassWebsocketEvent,
  TakerEventsMap,
  UseCase,
  OrderExecutor,
  TakerSource,
  AuthType,
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

  constructor({
    logger,
    debug,
  }: {
    logger?: (message: string) => void;
    debug?: boolean;
  }) {
    super();
    if (debug) this._logger = logger || console.log;
  }

  private _emitMessage(method: TakerMethod, params: unknown) {
    if (!this._socket) {
      this._logger?.(
        '[TakerProvider] Taker socket not connected. Cannot send message'
      );
      return;
    }
    if (!this._accessToken) {
      this._logger?.(
        '[TakerProvider] Access token not set. Cannot send message'
      );
      return;
    }
    const uuid = crypto.randomUUID();
    const message = {
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: uuid,
    };
    this._globalMessages.push({
      id: uuid,
      method,
      accessToken: this._accessToken,
    });
    this._logger?.(
      `[TakerProvider] Emitting message: ${JSON.stringify(message)}`
    );
    this._socket.emit('message', message);
  }

  private _getAuthObj({
    auth,
    source,
    allowForceDisconnect,
  }: {
    auth: AuthType;
    source: TakerSource;
    allowForceDisconnect?: boolean;
  }) {
    let authObj: Record<string, any> = {
      source,
      allowForceDisconnect,
    };

    if ('token' in auth) {
      authObj['token'] = auth.token;
    }

    if (source === 'API') {
      authObj = {
        ...authObj,
        clientId: auth.clientId,
        clientSecret: auth.clientSecret,
      };
    } else if (source === 'HOURGLASS_PROTOCOL' || source === 'ION_PROTOCOL') {
      authObj = {
        ...authObj,
        secret: auth.clientSecret,
      };
    }

    return authObj;
  }

  /*//////////////////////////////////////////////////////////////
                              CONNECT
    //////////////////////////////////////////////////////////////*/

  connect({
    auth,
    source,
    endpoint,
    allowForceDisconnect,
  }: {
    auth: AuthType;
    source: TakerSource;
    endpoint: string;
    allowForceDisconnect?: boolean;
  }) {
    if (auth.token) this._accessToken = auth.token;
    const authObj = this._getAuthObj({ auth, source, allowForceDisconnect });
    this._logger?.(
      `[TakerProvider] Connecting to taker socket: ${endpoint} - ${JSON.stringify(
        authObj
      )}`
    );
    this._socket = io(endpoint, {
      transports: ['websocket'],
      auth: authObj,
    });

    this._socket.on(
      HourglassWebsocketEvent.AccessToken,
      (data: { accessToken: string }, callback: (value: string) => void) => {
        callback('ACK');
        this._logger?.(
          `[TakerProvider] Received access token: ${data.accessToken}`
        );
        this._accessToken = data.accessToken;
        this.emit(HourglassWebsocketEvent.AccessToken, data, undefined);
      }
    );

    this._socket.on(
      HourglassWebsocketEvent.BestQuote,
      (data: any, callback: (value: string) => void) => {
        this._logger?.(
          `[TakerProvider] Received best quote: ${JSON.stringify(data)}`
        );
        this.emit(HourglassWebsocketEvent.BestQuote, data, undefined);
        callback('ACK');
      }
    );

    this._socket.on(
      HourglassWebsocketEvent.OrderFulfilled,
      (data: any, callback: (value: string) => void) => {
        this._logger?.(
          `[TakerProvider] Received order fulfilled: ${JSON.stringify(data)}`
        );
        this.emit(HourglassWebsocketEvent.OrderFulfilled, data, undefined);
        callback('ACK');
      }
    );

    this._socket.on(
      HourglassWebsocketEvent.OrderCreated,
      (data: any, callback: (value: string) => void) => {
        this._logger?.(
          `[TakerProvider] Received order created: ${JSON.stringify(data)}`
        );
        this.emit(HourglassWebsocketEvent.OrderCreated, data, undefined);
        callback('ACK');
      }
    );

    this._socket.on(
      'message',
      (data: { id: string; result: any; error: any }) => {
        const method = this._globalMessages.find(
          (m) => m.id === data.id
        )?.method;

        this._logger?.(
          `[TakerProvider] For ${method}, received message: ${JSON.stringify(
            data
          )}`
        );
        switch (method) {
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
      this._logger?.('[TakerProvider] Connected to taker socket');
      this.emit('connect');
    });

    this._socket.on('connect_error', (error) => {
      this._logger?.(`[TakerProvider] Connection error: ${error}`);
      this.emit('connect_error', error);
    });

    this._socket.on('disconnect', (reason, description) => {
      this._logger?.(
        `[TakerProvider] Disconnected: ${reason} - ${description}`
      );
      this.emit('disconnect', reason, description);
      this.connect({
        auth: {
          ...auth,
          token: this._accessToken,
        },
        source,
        endpoint,
        allowForceDisconnect,
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
    this._logger?.(`[TakerProvider] Requesting quote: ${JSON.stringify(data)}`);
    this._emitMessage(TakerMethod.hg_requestQuote, data);
  }

  acceptQuote(data: {
    quoteId: number;
    components?: SeaportOrderComponents;
    signature?: string;
  }) {
    this._logger?.(`[TakerProvider] Accepting quote: ${JSON.stringify(data)}`);
    this._emitMessage(TakerMethod.hg_acceptQuote, data);
  }
}

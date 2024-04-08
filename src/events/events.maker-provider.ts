import { TypedEventEmitter } from './events.utils';
import { io, Socket } from 'socket.io-client';
import {
  MakerMethod,
  MakerEventsMap,
  HourglassWebsocketEvent,
  AuthType,
} from './events.types';

export class MakerProvider extends TypedEventEmitter<MakerEventsMap> {
  private _socket: Socket | undefined;
  private _accessToken: string | undefined;
  private _globalMessages: {
    id: string;
    method: MakerMethod;
    accessToken: string;
  }[] = [];

  constructor() {
    super();
  }

  private _emitMessage(method: MakerMethod, params: unknown) {
    if (!this._socket) {
      console.error('Maker socket not connected. Cannot send message');
      return;
    }
    if (!this._accessToken) {
      console.error('Access token not set. Cannot send message');
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
    this._socket.emit('message', message);
  }

  private _getAuthObj({
    auth,
    allowForceDisconnect,
  }: {
    auth: AuthType;
    allowForceDisconnect?: boolean;
  }) {
    let authObj: Record<string, any> = {
      allowForceDisconnect,
    };

    if ('token' in auth) {
      authObj['token'] = auth.token;
    }

    authObj = {
      ...authObj,
      clientId: auth.clientId,
      clientSecret: auth.clientSecret,
    };

    return authObj;
  }

  /*//////////////////////////////////////////////////////////////
                              CONNECT
    //////////////////////////////////////////////////////////////*/

  connect({
    auth,
    endpoint,
    allowForceDisconnect = true,
  }: {
    auth: AuthType;
    endpoint: string;
    allowForceDisconnect?: boolean;
  }) {
    if (auth.token) this._accessToken = auth.token;
    const authObj = this._getAuthObj({ auth, allowForceDisconnect });
    this._socket = io(endpoint, {
      transports: ['websocket'],
      auth: authObj,
      autoConnect: false,
    });

    this._socket.on(
      HourglassWebsocketEvent.AccessToken,
      (data: { accessToken: string }, callback: (value: string) => void) => {
        callback('ACK');
        this._accessToken = data.accessToken;
        this.emit(HourglassWebsocketEvent.AccessToken, data, undefined);
      }
    );

    this._socket.on(
      'message',
      (data: { id: string; result: any; error: any }) => {
        const method = this._globalMessages.find(
          (m) => m.id === data.id
        )?.method;

        switch (method) {
          case MakerMethod.hg_submitQuote:
            this.emit(MakerMethod.hg_submitQuote, data.result, data.error);
            break;
          case MakerMethod.hg_subscribeToMarket:
            this.emit(
              MakerMethod.hg_subscribeToMarket,
              data.result,
              data.error
            );
            break;
          case MakerMethod.hg_unsubscribeFromMarket:
            this.emit(
              MakerMethod.hg_unsubscribeFromMarket,
              data.result,
              data.error
            );
            break;
          default:
            break;
        }
      }
    );

    this._socket.on(
      HourglassWebsocketEvent.OrderCreated,
      (data: any, callback: (value: string) => void) => {
        this.emit(HourglassWebsocketEvent.OrderCreated, data, undefined);
        callback('ACK');
      }
    );

    this._socket.on(
      HourglassWebsocketEvent.OrderFulfilled,
      (data: any, callback: (value: string) => void) => {
        this.emit(HourglassWebsocketEvent.OrderFulfilled, data, undefined);
        callback('ACK');
      }
    );

    this._socket.on(
      HourglassWebsocketEvent.QuoteAccepted,
      (data: any, callback: (value: string) => void) => {
        this.emit(HourglassWebsocketEvent.QuoteAccepted, data, undefined);
        callback('ACK');
      }
    );

    this._socket.on(
      HourglassWebsocketEvent.RequestForQuoteBroadcast,
      (data: any) => {
        // This event is emitted to all market makers within a market room. Since this is emitted to a room,
        // we don't need to ACK to the server.
        this.emit(
          HourglassWebsocketEvent.RequestForQuoteBroadcast,
          data,
          undefined
        );
      }
    );

    this._socket.on('connect', () => {
      this.emit('connect');
    });

    this._socket.on('connect_error', (error) => {
      this.emit('connect_error', error);
    });

    this._socket.on('disconnect', (reason, description) => {
      this.emit('disconnect', reason, description);
      this.connect({
        auth: { ...auth, token: this._accessToken },
        endpoint,
        allowForceDisconnect,
      });
    });
  }

  /*//////////////////////////////////////////////////////////////
                              ACTIONS
    //////////////////////////////////////////////////////////////*/

  submitQuote(data: { quoteAmount: string; rfqId: number }) {
    this._emitMessage(MakerMethod.hg_submitQuote, data);
  }

  subscribeToMarket(data: { marketId: number }) {
    this._emitMessage(MakerMethod.hg_subscribeToMarket, data);
  }

  unsubscribeFromMarket(data: { marketId: number }) {
    this._emitMessage(MakerMethod.hg_unsubscribeFromMarket, data);
  }
}

import EventEmitter from 'events';
import {
  DataMethod,
  JsonRpcMessage,
  MakerMethod,
  TakerMethod,
} from './events.types';

export class TypedEventEmitter<TEvents extends Record<string, Array<any>>> {
  private emitter = new EventEmitter();

  emit<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    ...eventArg: TEvents[TEventName]
  ) {
    this.emitter.emit(eventName, ...eventArg);
  }

  on<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    handler: (...eventArg: TEvents[TEventName]) => void
  ) {
    this.emitter.on(eventName, handler);
  }

  off<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    handler: (...eventArg: TEvents[TEventName]) => void
  ) {
    this.emitter.off(eventName, handler);
  }
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

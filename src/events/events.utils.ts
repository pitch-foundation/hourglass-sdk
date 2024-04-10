import { EventEmitter } from 'events';
import { DataMethod, MakerMethod, TakerMethod } from './events.types';

export class TypedEventEmitter<TEvents extends Record<string, any>> {
  private emitter = new EventEmitter();

  emit<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    ...eventArg: TEvents[TEventName]
  ) {
    this.emitter.emit(eventName, ...(eventArg as []));
  }

  on<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    handler: (...eventArg: TEvents[TEventName]) => void
  ) {
    this.emitter.on(eventName, handler as any);
  }

  off<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    handler: (...eventArg: TEvents[TEventName]) => void
  ) {
    this.emitter.off(eventName, handler as any);
  }
}

export type JsonRpcMessage<M extends DataMethod | MakerMethod | TakerMethod> = {
  jsonrpc: string; 
  method: M,
  params: any,
  id: string,
};

export const createMessage = <M extends DataMethod | MakerMethod | TakerMethod>(method: M, params: any): JsonRpcMessage<M> => {
  const uuid = crypto.randomUUID();
  const message = {
    jsonrpc: '2.0',
    method: method,
    params: params,
    id: uuid,
  };
  return message;
}
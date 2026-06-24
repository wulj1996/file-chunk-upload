import { UploaderEventMap } from '@/types';

type Callback = (...args: any[]) => void;

export class EventBus {
  private listenerMap: Map<keyof UploaderEventMap, Callback[]> = new Map();

  on<T extends keyof UploaderEventMap>(eventName: T, callback: UploaderEventMap[T]) {
    const listeners = this.listenerMap.get(eventName);
    if (listeners) {
      listeners.push(callback);
    } else {
      this.listenerMap.set(eventName, [callback]);
    }
  }

  remove<T extends keyof UploaderEventMap>(eventName: T, callback: UploaderEventMap[T]) {
    const oldListener = this.listenerMap.get(eventName) ?? [];
    const newListener = oldListener.filter((l) => l !== callback);
    this.listenerMap.set(eventName, newListener);
  }

  emit<T extends keyof UploaderEventMap>(eventName: T, ...args: Parameters<UploaderEventMap[T]>) {
    const listener = this.listenerMap.get(eventName) ?? [];
    listener.forEach((l) => {
      l(...args);
    });
  }
}

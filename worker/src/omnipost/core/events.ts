import { UnifiedPost, PostResult, PostError } from './types';

export type EventPayloads = {
  beforePost: { post: UnifiedPost; platformId: string };
  afterPost: { post: UnifiedPost; platformId: string; result: PostResult };
  afterFailure: { post: UnifiedPost; platformId: string; error: PostError };
  afterRefreshToken: { platformId: string; userId: string };
};

type Listener<K extends keyof EventPayloads> = (payload: EventPayloads[K]) => void;

export class EventBus {
  private listeners: { [K in keyof EventPayloads]?: Listener<K>[] } = {};

  on<K extends keyof EventPayloads>(event: K, fn: Listener<K>): void {
    const list = (this.listeners[event] ??= []) as Listener<K>[];
    list.push(fn);
  }

  emit<K extends keyof EventPayloads>(event: K, payload: EventPayloads[K]): void {
    const list = this.listeners[event] as Listener<K>[] | undefined;
    for (const fn of list ?? []) fn(payload);
  }
}

import { SessionEvent } from './types';

export class EventBuffer {
  private buffer: SessionEvent[] = [];
  private maxSize: number;
  private flushCallback?: (events: SessionEvent[]) => void;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  onFlush(callback: (events: SessionEvent[]) => void): void {
    this.flushCallback = callback;
  }

  push(event: SessionEvent): void {
    this.buffer.push(event);

    if (this.buffer.length >= this.maxSize) {
      this.flush();
    }
  }

  flush(): SessionEvent[] {
    const events = [...this.buffer];
    this.buffer = [];

    if (this.flushCallback && events.length > 0) {
      this.flushCallback(events);
    }

    return events;
  }

  getAll(): SessionEvent[] {
    return [...this.buffer];
  }

  size(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer = [];
  }
}

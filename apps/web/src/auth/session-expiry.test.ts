import { describe, expect, it, vi } from "vitest";

import {
  MAX_SESSION_TIMEOUT_MS,
  scheduleSessionExpiry,
  type SessionExpiryScheduler,
} from "./session-expiry";

interface ScheduledTimer {
  readonly callback: () => void;
  readonly delayMs: number;
}

class FakeScheduler implements SessionExpiryScheduler {
  private currentTime: number;
  private nextTimerId = 1;

  readonly timers = new Map<number, ScheduledTimer>();

  constructor(now: number) {
    this.currentTime = now;
  }

  readonly now = (): number => this.currentTime;

  readonly setTimeout = (callback: () => void, delayMs: number): number => {
    const timerId = this.nextTimerId++;

    this.timers.set(timerId, {
      callback,
      delayMs,
    });

    return timerId;
  };

  readonly clearTimeout = (timeoutId: number): void => {
    this.timers.delete(timeoutId);
  };

  get delays(): readonly number[] {
    return [...this.timers.values()].map(({ delayMs }) => delayMs);
  }

  runNext(): void {
    const next = this.timers.entries().next().value as [number, ScheduledTimer] | undefined;

    if (!next) {
      throw new Error("No scheduled timer.");
    }

    const [timerId, timer] = next;

    this.timers.delete(timerId);
    this.currentTime += timer.delayMs;
    timer.callback();
  }
}

describe("scheduleSessionExpiry", () => {
  it("expires an already elapsed session immediately", () => {
    const scheduler = new FakeScheduler(2_000);
    const onExpire = vi.fn();

    const cancel = scheduleSessionExpiry(2_000, onExpire, scheduler);

    expect(onExpire).toHaveBeenCalledTimes(1);

    expect(scheduler.timers.size).toBe(0);

    cancel();
  });

  it("expires a session after the remaining delay", () => {
    const scheduler = new FakeScheduler(1_000);
    const onExpire = vi.fn();

    scheduleSessionExpiry(2_500, onExpire, scheduler);

    expect(scheduler.delays).toEqual([1_500]);

    scheduler.runNext();

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("reschedules lifetimes longer than the browser timeout limit", () => {
    const scheduler = new FakeScheduler(1_000);
    const onExpire = vi.fn();

    scheduleSessionExpiry(1_000 + MAX_SESSION_TIMEOUT_MS + 500, onExpire, scheduler);

    expect(scheduler.delays).toEqual([MAX_SESSION_TIMEOUT_MS]);

    scheduler.runNext();

    expect(onExpire).not.toHaveBeenCalled();

    expect(scheduler.delays).toEqual([500]);

    scheduler.runNext();

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending expiry callback", () => {
    const scheduler = new FakeScheduler(1_000);
    const onExpire = vi.fn();

    const cancel = scheduleSessionExpiry(2_000, onExpire, scheduler);

    cancel();

    expect(scheduler.timers.size).toBe(0);

    expect(onExpire).not.toHaveBeenCalled();
  });
});

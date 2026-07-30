export const MAX_SESSION_TIMEOUT_MS = 2_147_483_647;

export interface SessionExpiryScheduler {
  readonly now: () => number;
  readonly setTimeout: (callback: () => void, delayMs: number) => number;
  readonly clearTimeout: (timeoutId: number) => void;
}

const browserScheduler: SessionExpiryScheduler = {
  now: () => Date.now(),

  setTimeout(callback, delayMs) {
    return window.setTimeout(callback, delayMs);
  },

  clearTimeout(timeoutId) {
    window.clearTimeout(timeoutId);
  },
};

export function scheduleSessionExpiry(
  expiresAt: number,
  onExpire: () => void,
  scheduler = browserScheduler,
): () => void {
  if (!Number.isSafeInteger(expiresAt)) {
    throw new TypeError("Session expiry timestamp must be a safe integer.");
  }

  let timeoutId: number | undefined;
  let cancelled = false;

  function scheduleNext(): void {
    if (cancelled) {
      return;
    }

    const now = scheduler.now();

    if (!Number.isSafeInteger(now)) {
      throw new TypeError("Current timestamp must be a safe integer.");
    }

    const remainingMs = expiresAt - now;

    if (remainingMs <= 0) {
      cancelled = true;
      onExpire();

      return;
    }

    timeoutId = scheduler.setTimeout(scheduleNext, Math.min(remainingMs, MAX_SESSION_TIMEOUT_MS));
  }

  scheduleNext();

  return () => {
    cancelled = true;

    if (timeoutId !== undefined) {
      scheduler.clearTimeout(timeoutId);
    }
  };
}

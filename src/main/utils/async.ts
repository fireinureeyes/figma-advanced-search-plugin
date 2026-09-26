/**
 * Cooperative multitasking for the plugin sandbox.
 *
 * The sandbox is single-threaded: a synchronous `findAll()` over a 200k-node
 * document blocks the message queue, so nothing the user does in the UI is even
 * *delivered* until it finishes. Every long walk in this plugin therefore runs
 * through `Scheduler`, which hands control back to the event loop roughly every
 * `SLICE_MS`, letting queued `figma.ui.onmessage` callbacks run — that is what
 * makes editing filters mid-scan possible.
 */

/** How long we may hold the thread before yielding. ~1 frame. */
const SLICE_MS = 16;

export function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export class CancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'CancelledError';
  }
}

let jobSequence = 0;

/** A unit of cancellable work. Superseded jobs stop at their next yield point. */
export class Job {
  readonly id: number;
  private cancelled = false;

  constructor() {
    this.id = ++jobSequence;
  }

  cancel(): void {
    this.cancelled = true;
  }

  get isCancelled(): boolean {
    return this.cancelled;
  }

  throwIfCancelled(): void {
    if (this.cancelled) throw new CancelledError();
  }
}

/**
 * Time-sliced loop guard. Call `await slice.tick()` inside a hot loop: it is a
 * no-op until the slice budget is spent, then it yields and re-checks the job.
 */
export class Slice {
  private deadline = Date.now() + SLICE_MS;

  constructor(private readonly job: Job) {}

  /** Returns `true` when it actually yielded (useful for throttling progress). */
  async tick(): Promise<boolean> {
    if (Date.now() < this.deadline) return false;
    await nextTick();
    this.job.throwIfCancelled();
    this.deadline = Date.now() + SLICE_MS;
    return true;
  }

  /** Yield unconditionally (used around awaits we know are expensive). */
  async yield(): Promise<void> {
    await nextTick();
    this.job.throwIfCancelled();
    this.deadline = Date.now() + SLICE_MS;
  }
}

/** Fires at most once per `intervalMs` — used to throttle progress messages. */
export class Throttle {
  private last = 0;

  constructor(private readonly intervalMs: number) {}

  ready(force = false): boolean {
    const now = Date.now();
    if (!force && now - this.last < this.intervalMs) return false;
    this.last = now;
    return true;
  }
}

import type { PluginMessage, UiMessage } from '../shared/messages';

export function post(message: UiMessage): void {
  parent.postMessage({ pluginMessage: message }, '*');
}

export function onPluginMessage(handler: (message: PluginMessage) => void): void {
  window.onmessage = (event: MessageEvent) => {
    const message = event.data && event.data.pluginMessage;
    if (!message || typeof message.type !== 'string') return;
    handler(message as PluginMessage);
  };
}

/** Collapses bursts of edits (typing in a filter) into a single scan. */
export function debounce<T extends (...args: any[]) => void>(fn: T, waitMs: number): T {
  let timer: number | undefined;
  return function debounced(this: unknown, ...args: any[]) {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn.apply(this, args);
    }, waitMs) as unknown as number;
  } as T;
}

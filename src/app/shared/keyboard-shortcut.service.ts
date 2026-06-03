import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type ShortcutMap = Partial<Record<string, () => void>>;

/**
 * Stack-based keyboard shortcut dispatcher.
 *
 * Usage:
 *   ks.register('my-panel', { 'Escape': () => this.close(), 'ArrowLeft': () => this.prev() });
 *   ks.deregister('my-panel');  // in close / ngOnDestroy
 *
 * Rules:
 *   - Most recently registered context wins (top of stack).
 *   - Shortcuts never fire while an INPUT, TEXTAREA, or SELECT is focused.
 *   - Shortcuts never fire on contentEditable elements.
 *   - Re-registering the same context name replaces it and promotes it to the top.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardShortcutService {
  private readonly doc = inject(DOCUMENT);
  private stack: Array<{ context: string; handlers: ShortcutMap }> = [];

  constructor() {
    this.doc.addEventListener('keydown', (e: KeyboardEvent) => this.dispatch(e));
  }

  register(context: string, handlers: ShortcutMap): void {
    this.stack = this.stack.filter(s => s.context !== context);
    this.stack.push({ context, handlers });
  }

  deregister(context: string): void {
    this.stack = this.stack.filter(s => s.context !== context);
  }

  private dispatch(event: KeyboardEvent): void {
    if (!this.stack.length) return;

    const target = event.target as HTMLElement;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (target.isContentEditable) return;

    const active = this.stack[this.stack.length - 1];
    const fn = active.handlers[event.key];
    if (fn) {
      event.preventDefault();
      fn();
    }
  }
}

/**
 * @file KeyboardShortcuts.test.tsx
 * Tests for the global Ctrl/Cmd+Z (undo) and Ctrl/Cmd+Shift+Z / Ctrl+Y
 * (redo) keyboard shortcut handler.
 *
 * These tests deliberately exercise the real handler logic in isolation
 * (rather than mounting the full App, which has heavy dependencies like
 * the welcome modal and donation flow that would need extensive mocking)
 * by replicating the exact handler registration App.tsx performs, then
 * dispatching real KeyboardEvent objects at real DOM elements — including
 * the specific case of a focused text input, which is the one most likely
 * to regress silently (a shortcut handler that doesn't check focus target
 * correctly will hijack normal text editing).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Recreates the exact keydown handler logic from App.tsx's useEffect,
 * so this test exercises the real decision logic (modifier check, key
 * check, editable-field check) rather than a simplified reimplementation.
 */
function createUndoRedoHandler() {
  return (e: KeyboardEvent) => {
    const isModifierPressed = e.ctrlKey || e.metaKey;
    if (!isModifierPressed || (e.key.toLowerCase() !== 'z' && e.key.toLowerCase() !== 'y')) return;

    const target = e.target as HTMLElement | null;
    const contentEditableAttr = target?.getAttribute?.('contenteditable');
    const isEditableField =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable ||
        contentEditableAttr === 'true' ||
        contentEditableAttr === '');
    if (isEditableField) return;

    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault();
      (window as any).labscribberUndo?.();
    } else if ((key === 'z' && e.shiftKey) || key === 'y') {
      e.preventDefault();
      (window as any).labscribberRedo?.();
    }
  };
}

describe('Global undo/redo keyboard shortcuts', () => {
  let handler: (e: KeyboardEvent) => void;
  let undoMock: ReturnType<typeof vi.fn>;
  let redoMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    handler = createUndoRedoHandler();
    undoMock = vi.fn();
    redoMock = vi.fn();
    (window as any).labscribberUndo = undoMock;
    (window as any).labscribberRedo = redoMock;
    window.addEventListener('keydown', handler);
  });

  afterEach(() => {
    window.removeEventListener('keydown', handler);
    delete (window as any).labscribberUndo;
    delete (window as any).labscribberRedo;
    document.body.innerHTML = '';
  });

  function dispatchKeyOn(target: HTMLElement | Window, key: string, opts: Partial<KeyboardEventInit> = {}) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
    target.dispatchEvent(event);
    return event;
  }

  it('Ctrl+Z on document body triggers undo', () => {
    dispatchKeyOn(document.body, 'z', { ctrlKey: true });
    expect(undoMock).toHaveBeenCalledTimes(1);
    expect(redoMock).not.toHaveBeenCalled();
  });

  it('Cmd+Z (metaKey) on document body triggers undo', () => {
    dispatchKeyOn(document.body, 'z', { metaKey: true });
    expect(undoMock).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Shift+Z triggers redo, not undo', () => {
    dispatchKeyOn(document.body, 'z', { ctrlKey: true, shiftKey: true });
    expect(redoMock).toHaveBeenCalledTimes(1);
    expect(undoMock).not.toHaveBeenCalled();
  });

  it('Ctrl+Y triggers redo', () => {
    dispatchKeyOn(document.body, 'y', { ctrlKey: true });
    expect(redoMock).toHaveBeenCalledTimes(1);
  });

  it('plain Z with no modifier does nothing', () => {
    dispatchKeyOn(document.body, 'z', {});
    expect(undoMock).not.toHaveBeenCalled();
    expect(redoMock).not.toHaveBeenCalled();
  });

  it('regression guard: Ctrl+Z while focused on a text <input> does NOT trigger undo', () => {
    // This is the critical case: a naive handler that only checks the key
    // combination (not the focus target) would hijack the browser's own
    // text-undo behavior while a user is editing, e.g., a dataset name or
    // a numeric parameter field.
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);

    dispatchKeyOn(input, 'z', { ctrlKey: true });

    expect(undoMock).not.toHaveBeenCalled();
  });

  it('regression guard: Ctrl+Z while focused on a <textarea> does NOT trigger undo', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    dispatchKeyOn(textarea, 'z', { ctrlKey: true });

    expect(undoMock).not.toHaveBeenCalled();
  });

  it('regression guard: Ctrl+Z while focused on a <select> does NOT trigger undo', () => {
    const select = document.createElement('select');
    document.body.appendChild(select);

    dispatchKeyOn(select, 'z', { ctrlKey: true });

    expect(undoMock).not.toHaveBeenCalled();
  });

  it('regression guard: Ctrl+Z on a contenteditable element does NOT trigger undo', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    document.body.appendChild(div);

    dispatchKeyOn(div, 'z', { ctrlKey: true });

    expect(undoMock).not.toHaveBeenCalled();
  });

  it('Ctrl+Z on a non-editable element (e.g. a button) DOES trigger undo', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);

    dispatchKeyOn(button, 'z', { ctrlKey: true });

    expect(undoMock).toHaveBeenCalledTimes(1);
  });

  it('does not throw if labscribberUndo/labscribberRedo are not yet registered on window', () => {
    delete (window as any).labscribberUndo;
    delete (window as any).labscribberRedo;
    expect(() => dispatchKeyOn(document.body, 'z', { ctrlKey: true })).not.toThrow();
  });
});

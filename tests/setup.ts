/**
 * @file setup.ts
 * Vitest global setup — runs once before all test files.
 *
 * Imports @testing-library/jest-dom's matchers (toBeInTheDocument,
 * toHaveTextContent, etc.) so component tests can use them without
 * importing them individually in every test file.
 *
 * Also registers automatic DOM cleanup after each test. React Testing
 * Library does not auto-cleanup under Vitest the way some other test
 * runners' jsdom integrations do — without this, every test's render()
 * call accumulates in the document rather than being unmounted, which
 * causes document.querySelector-based element lookups in later tests to
 * silently grab a stale element from an earlier test's render tree.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

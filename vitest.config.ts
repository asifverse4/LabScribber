/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for Labscribber.
 *
 * Default environment is jsdom, required for component tests (ObjectBrowser,
 * SpectrumPlot, etc.) which render real React components. math.test.ts does
 * not need a DOM at all — it's tested with `@vitest-environment node` set
 * per-file via a docblock comment at the top of that file, since pure
 * computation tests run meaningfully faster without DOM setup overhead.
 *
 * Note: no @vitejs/plugin-react here. Vitest's bundled esbuild transform
 * already handles .tsx JSX correctly for test files; adding the React
 * plugin caused a type conflict between vitest's internal Vite dependency
 * and the project's own Vite version (two structurally similar but
 * distinct Plugin<any> types), which tsc correctly flagged even though
 * the actual test run and production build both worked regardless.
 *
 * Run with: npm test
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/utils/math.ts',
        'src/utils/methodsGenerator.ts',
        'src/utils/batchSummary.ts',
        'src/utils/provenance.ts',
        'src/utils/autosave.ts',
        'src/utils/jcampParser.ts',
        'src/utils/plotDomain.ts',
        'src/components/**/*.tsx',
        'src/App.tsx',
      ],
      exclude: ['**/*.test.ts', '**/*.test.tsx'],
    },
  },
});

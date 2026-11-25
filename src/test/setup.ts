import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';

(globalThis as unknown as { __APP_VERSION__: string }).__APP_VERSION__ = 'test';

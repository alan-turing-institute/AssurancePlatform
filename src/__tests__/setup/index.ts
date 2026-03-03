/**
 * Test setup barrel — imported by vitest.config.ts as the setupFiles entry.
 *
 * Each module handles one concern:
 * - jest-dom: Testing Library matchers and cleanup
 * - msw: Mock Service Worker lifecycle
 * - framework-mocks: Next.js, next-auth, next-themes, toast, modal hooks
 * - dom-polyfills: Browser API polyfills missing from jsdom
 * - component-mocks: ReactFlow and Radix UI component mocks
 */
import "./jest-dom";
import "./msw";
import "./framework-mocks";
import "./dom-polyfills";
import "./component-mocks";

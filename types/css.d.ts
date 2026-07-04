/**
 * Ambient shim for CSS side-effect imports (`import "./foo.css"`).
 *
 * TypeScript 5.9 (current) already resolves these via Next.js's built-in
 * module augmentation, so this declaration is currently inert. TypeScript 6
 * tightens module resolution in a way that would otherwise error on bare
 * side-effect CSS imports — this file is forward-compat cover for that
 * upgrade, added ahead of time rather than as a reactive fix.
 */
declare module "*.css";

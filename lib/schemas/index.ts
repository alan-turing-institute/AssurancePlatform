// Base schemas

// Domain schemas for Server Actions
export * from "./assurance-case";
export * from "./base";
export * from "./capture";
export * from "./case-study";

// Note: case-export.ts, element-validation.ts, and version-detection.ts
// are not re-exported here due to naming conflicts and specialised usage.
// Import them directly when needed:
//   import { ... } from "@/lib/schemas/case-export";
//   import { ... } from "@/lib/schemas/element-validation";
//   import { ... } from "@/lib/schemas/version-detection";

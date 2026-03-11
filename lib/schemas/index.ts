// Base schemas

// Domain schemas for Server Actions
export * from "./assurance-case";
export * from "./auth";
export * from "./base";
export * from "./case-study";
export * from "./comment";
export * from "./element";
export * from "./google-drive";
export * from "./permission";
export * from "./status";
// Domain schemas for API routes
export * from "./team";
export * from "./tour";
export * from "./user";

// Note: batch-update.ts, case-export.ts, connected-accounts.ts, element-validation.ts,
// github-import.ts, and version-detection.ts are not re-exported here due to naming
// conflicts and specialised usage. Import them directly when needed:
//   import { ... } from "@/lib/schemas/batch-update";
//   import { ... } from "@/lib/schemas/case-export";
//   import { ... } from "@/lib/schemas/connected-accounts";
//   import { ... } from "@/lib/schemas/element-validation";
//   import { ... } from "@/lib/schemas/github-import";
//   import { ... } from "@/lib/schemas/version-detection";

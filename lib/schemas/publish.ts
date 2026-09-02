import { z } from "zod";
import { optionalString } from "./base";

/**
 * POST /api/cases/[id]/publish body. `description` here is the published
 * version's note (e.g. "Initial release") — distinct from the case
 * information description gated by `getMissingCaseInformationFields`
 * (`lib/schemas/case-information.ts`), which is the public-facing summary
 * of the case itself.
 */
export const publishCaseBodySchema = z.strictObject({
	description: optionalString(2000),
});

export type PublishCaseBodyInput = z.input<typeof publishCaseBodySchema>;
export type PublishCaseBodyOutput = z.output<typeof publishCaseBodySchema>;

import { z } from "zod";
import { uuidSchema } from "@/lib/schemas/base";
import { CaseKindSchema } from "@/lib/schemas/case-export";

/**
 * `actions/case-kind.ts`'s `convertCaseKind` input. The kind of a case is
 * written only through that action, never through the ordinary case-update
 * schema, which anyone with EDIT permission can reach.
 */
export const convertCaseKindSchema = z.strictObject({
	caseId: uuidSchema,
	targetKind: CaseKindSchema,
});

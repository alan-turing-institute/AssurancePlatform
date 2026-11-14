"use server";

import { validateSession } from "@/lib/auth/validate-session";
import type { ActionResult } from "@/lib/errors";
import {
	type CreateAssuranceCaseInput,
	createAssuranceCaseSchema,
} from "@/lib/schemas/assurance-case";
import type { CaseKind } from "@/lib/schemas/case-export";
import type { AdministrableCaseSummary } from "@/lib/services/case-fetch-service";
import { validateInput } from "@/lib/validation/input-validation";

interface AssuranceCase {
	createdDate?: string;
	description?: string;
	id: number | string;
	isDemo?: boolean;
	kind?: CaseKind;
	name: string;
	owner?: number | string;
	published?: boolean;
	updatedDate?: string;
}

export const fetchAssuranceCases = async (): Promise<
	AssuranceCase[] | null
> => {
	const validated = await validateSession();
	if (!validated) {
		return null;
	}

	const { listUserCases } = await import("@/lib/services/case-fetch-service");
	const result = await listUserCases(validated.userId);
	if ("error" in result) {
		return null;
	}
	return result.data;
};

export const fetchAdministrableCases = async (): Promise<
	AdministrableCaseSummary[] | null
> => {
	const validated = await validateSession();
	if (!validated) {
		return null;
	}

	const { listAdministrableCases } = await import(
		"@/lib/services/case-fetch-service"
	);
	const result = await listAdministrableCases(validated.userId);
	if ("error" in result) {
		return null;
	}
	return result.data;
};

export const fetchSharedAssuranceCases = async (): Promise<
	AssuranceCase[] | null
> => {
	const validated = await validateSession();
	if (!validated) {
		return null;
	}

	const { listSharedCases } = await import("@/lib/services/case-fetch-service");
	const result = await listSharedCases(validated.userId);
	if ("error" in result) {
		return null;
	}
	return result.data;
};

export const createAssuranceCase = async (
	input: CreateAssuranceCaseInput
): Promise<ActionResult<{ id: string }>> => {
	const validated = await validateSession();
	if (!validated) {
		return { success: false, error: "Invalid session" };
	}

	const validation = validateInput(input, createAssuranceCaseSchema);
	if (!validation.success) {
		return {
			success: false,
			error: validation.error,
			fieldErrors: validation.fieldErrors,
		};
	}

	const { createCase } = await import("@/lib/services/case-fetch-service");
	const result = await createCase(validated.userId, {
		name: validation.data.name,
		description: validation.data.description,
		colourProfile: validation.data.colourProfile,
		kind: validation.data.kind,
	});

	if ("error" in result) {
		return { success: false, error: result.error };
	}

	return { success: true, data: result.data };
};

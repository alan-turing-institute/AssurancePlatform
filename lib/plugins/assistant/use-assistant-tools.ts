"use client";

import { useCallback } from "react";
import { parseErrorMessage, useFetchOnMount } from "@/hooks/use-fetch-on-mount";

async function requestAssistantTools(caseId: string): Promise<string[]> {
	const response = await fetch(`/api/cases/${caseId}/assistant`);
	if (!response.ok) {
		throw new Error(await parseErrorMessage(response));
	}
	const body = (await response.json()) as { tools?: unknown };
	return Array.isArray(body.tools)
		? body.tools.filter((name): name is string => typeof name === "string")
		: [];
}

/** The names of the tools the assistant has for a case. Null while the request is running and when it fails. */
export function useAssistantTools(caseId: string): string[] | null {
	const fetcher = useCallback(() => requestAssistantTools(caseId), [caseId]);
	return useFetchOnMount(fetcher).data;
}

/**
 * API operations for assurance case nodes
 * Handles CRUD operations and element attachment/detachment
 */

import type { Context, Evidence, Goal, PropertyClaim, Strategy } from "@/types";
import type { ReactFlowNode } from "./types";

// API Response types
type ApiNodeResponse = {
	id: number;
	name: string;
	short_description: string;
	long_description: string;
	type: string;
	[key: string]: unknown;
};

// Comment type for API operations
type CommentPayload = {
	content: string;
	[key: string]: unknown;
};

// Type for node creation payloads
type CreateNodePayload =
	| Partial<Goal>
	| Partial<Context>
	| Partial<Strategy>
	| Partial<PropertyClaim>
	| Partial<Evidence>;

/**
 * Creates a new assurance case node by sending a POST request to the specified API endpoint.
 */
export const createAssuranceCaseNode = async (
	entity: string,
	newItem: CreateNodePayload,
	token: string | null
): Promise<{ data?: ApiNodeResponse; error?: string | unknown }> => {
	if (!token) {
		return { error: "No token" };
	}

	// Get case ID from the payload
	const caseId = (newItem as { assurance_case_id?: number | string })
		.assurance_case_id;
	if (!caseId) {
		return { error: "Case ID is required" };
	}

	// Map entity to element type for unified API
	const elementTypeMap: Record<string, string> = {
		goals: "goal",
		contexts: "context",
		strategies: "strategy",
		propertyclaims: "property_claim",
		evidence: "evidence",
	};

	try {
		// Use internal API route which handles Django/Prisma switching
		const url = `/api/cases/${caseId}/elements`;

		const requestOptions: RequestInit = {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				...newItem,
				elementType: elementTypeMap[entity] || entity,
				type: elementTypeMap[entity] || entity,
			}),
		};
		const response = await fetch(url, requestOptions);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return {
				error: errorData.error || `Something went wrong ${response.status}`,
			};
		}

		const result = await response.json();

		const data = {
			...result,
			id: result.id,
		};

		return { data };
	} catch (error) {
		return { error };
	}
};

/**
 * Deletes an assurance case node by sending a DELETE request to the specified API endpoint.
 */
export const deleteAssuranceCaseNode = async (
	_type: string,
	id: number | string,
	token: string | null
): Promise<boolean | { error: string }> => {
	if (!token) {
		return { error: "No token" };
	}

	try {
		// Use internal API route which handles Django/Prisma switching
		const url = `/api/elements/${id}`;

		const requestOptions: RequestInit = {
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
			},
		};
		const response = await fetch(url, requestOptions);

		if (response.ok) {
			return true;
		}
		const errorData = await response.json().catch(() => ({}));
		return { error: errorData.error || "Failed to delete node" };
	} catch (_error) {
		return { error: "An error occurred" };
	}
};

/**
 * Updates an existing assurance case node by sending a PUT request to the specified API endpoint.
 */
export const updateAssuranceCaseNode = async (
	_type: string,
	id: number | string,
	token: string | null,
	updateItem: unknown
): Promise<boolean | { error: string }> => {
	if (!token) {
		return { error: "No token" };
	}

	try {
		// Use internal API route which handles Django/Prisma switching
		const url = `/api/elements/${id}`;

		const requestOptions: RequestInit = {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(updateItem),
		};
		const response = await fetch(url, requestOptions);

		if (response.ok) {
			return true;
		}
		const errorData = await response.json().catch(() => ({}));
		return { error: errorData.error || "Failed to update node" };
	} catch (_error) {
		return { error: "An error occurred" };
	}
};

/**
 * Gets an assurance case node by ID.
 */
export const getAssuranceCaseNode = async (
	_type: string,
	id: number | string,
	token: string | null
): Promise<ApiNodeResponse | { error: string } | false> => {
	if (!token) {
		return { error: "No token" };
	}

	try {
		// Use internal API route which handles Django/Prisma switching
		const url = `/api/elements/${id}`;

		const requestOptions: RequestInit = {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		};
		const response = await fetch(url, requestOptions);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return { error: errorData.error || "Failed to fetch node" };
		}

		const result = await response.json();
		return result;
	} catch (_error) {
		return false;
	}
};

/**
 * Detaches an element from its parent in the assurance case.
 */
export const detachCaseElement = async (
	_node: ReactFlowNode,
	type: string,
	id: number | string,
	token: string | null
): Promise<{ detached: boolean } | { error: string | unknown }> => {
	if (!token) {
		return { error: "No token" };
	}

	try {
		// Use internal API route which handles Django/Prisma switching
		const url = `/api/elements/${id}/detach?element_type=${type}`;

		const requestOptions: RequestInit = {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
		};

		const response = await fetch(url, requestOptions);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return {
				error: errorData.error || `Something went wrong ${response.status}`,
			};
		}

		return { detached: true };
	} catch (error) {
		return { error };
	}
};

/**
 * Attaches an orphan node to a specified parent in the assurance case.
 */
export const attachCaseElement = async (
	orphan: ReactFlowNode,
	id: number | string,
	token: string | null,
	parent: ReactFlowNode
): Promise<{ attached: boolean } | { error: string | unknown }> => {
	if (!token) {
		return { error: "No token" };
	}

	// Build payload for attach operation
	const payload: {
		parentId?: string | number;
		element_type?: string;
		goal_id?: number | null;
		strategy_id?: number | null;
		property_claim_id?: number | null;
	} = {
		parentId: parent.data.id,
		element_type: orphan.type.toLowerCase(),
	};

	// Also include Django-style parent references for fallback
	switch (orphan.type.toLowerCase()) {
		case "context":
		case "strategy":
			payload.goal_id = parent.data.id;
			break;
		case "propertyclaim":
			if (parent.type === "property") {
				payload.property_claim_id = parent.data.id;
			}
			if (parent.type === "strategy") {
				payload.strategy_id = parent.data.id;
			}
			if (parent.type === "goal") {
				payload.goal_id = parent.data.id;
			}
			break;
		case "evidence":
			payload.property_claim_id = parent.data.id;
			break;
		default:
			break;
	}

	try {
		// Use internal API route which handles Django/Prisma switching
		const url = `/api/elements/${id}/attach`;

		const requestOptions: RequestInit = {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		};
		const response = await fetch(url, requestOptions);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return {
				error: errorData.error || `Something went wrong ${response.status}`,
			};
		}

		return { attached: true };
	} catch (error) {
		return { error };
	}
};

/**
 * Adds a comment to an element.
 */
export const addElementComment = async (
	entity: string,
	id: number,
	newComment: CommentPayload,
	token: string | null
): Promise<Comment | { error: string | unknown }> => {
	if (!token) {
		return { error: "No token" };
	}

	try {
		const url = `${process.env.NEXT_PUBLIC_API_URL}/api/${entity}/${id}/comment`;

		const requestOptions: RequestInit = {
			method: "POST",
			headers: {
				Authorization: `Token ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(newComment),
		};
		const response = await fetch(url, requestOptions);

		if (!response.ok) {
			// Handle non-ok response
		}

		const result = await response.json();

		return result;
	} catch (error) {
		return { error };
	}
};

type UpdateCommentOptions = {
	entity: string;
	id: number;
	newComment: CommentPayload;
	newCommentId: number;
	token: string | null;
};

/**
 * Updates a comment on an element.
 */
export const updateElementComment = async (
	options: UpdateCommentOptions
): Promise<Comment | { error: string | unknown }> => {
	const { entity, id, newComment, newCommentId, token } = options;

	if (!token) {
		return { error: "No token" };
	}

	try {
		const url = `${process.env.NEXT_PUBLIC_API_URL}/api/${entity}/${id}/comment/${newCommentId}`;

		const requestOptions: RequestInit = {
			method: "PUT",
			headers: {
				Authorization: `Token ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(newComment),
		};
		const response = await fetch(url, requestOptions);

		if (!response.ok) {
			// Handle non-ok response
		}

		const result = await response.json();

		return result;
	} catch (error) {
		return { error };
	}
};

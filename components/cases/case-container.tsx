"use client";

import { Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReactFlowProvider } from "reactflow";
import CheckTourClient from "@/components/tour/check-tour-client";
import { ErrorCard } from "@/components/ui/error-card";
import type { SSEEvent } from "@/hooks/use-case-events";
import { useCaseEvents } from "@/hooks/use-case-events";
import { addHiddenProp, fetchAndRefreshCase } from "@/lib/case";
import { toastError, toastInfo } from "@/lib/toast";
import useHistoryStore from "@/store/history-store";
import useStore from "@/store/store";
import type { AssuranceCase } from "@/types";
import { ErrorBoundary } from "../ui/error-boundary";
import CaseDetails from "./case-details";
import Flow from "./flow";
import Header from "./header";

type CaseContainerProps = {
	caseId?: string;
};

/** Event types that trigger a case refetch */
const REFETCH_EVENTS = [
	"case:updated",
	"element:created",
	"element:updated",
	"element:deleted",
	"element:restored",
	"element:attached",
	"element:detached",
	"element:moved",
	"comment:created",
	"comment:updated",
	"comment:deleted",
	"permission:changed",
];

/** Event types that also require orphan refetch */
const ORPHAN_REFETCH_EVENTS = ["element:attached", "element:detached"];

/** Message templates for SSE event types: [withElement, withoutElement] */
const EVENT_MESSAGE_TEMPLATES: Record<string, [string, string]> = {
	"case:updated": ["updated the case details", "updated the case details"],
	"element:created": ['added "{element}"', "added a new element"],
	"element:updated": ['modified "{element}"', "modified an element"],
	"element:deleted": ['removed "{element}"', "removed an element"],
	"element:restored": ['restored "{element}"', "restored an element"],
	"element:attached": ['attached "{element}"', "attached an element"],
	"element:detached": ['detached "{element}"', "detached an element"],
	"element:moved": ['moved "{element}"', "moved an element"],
	"comment:created": ['added a comment to "{element}"', "added a comment"],
	"comment:updated": ['updated a comment on "{element}"', "updated a comment"],
	"comment:deleted": [
		'deleted a comment from "{element}"',
		"deleted a comment",
	],
};

/**
 * Extracts element name from SSE event payload.
 */
function getElementName(event: SSEEvent): string | undefined {
	return (
		(event.payload?.elementName as string) ||
		(event.payload?.element as { name?: string })?.name ||
		(event.payload?.element as { description?: string })?.description
	);
}

/**
 * Builds a human-readable toast message for an SSE event.
 */
function buildToastMessage(event: SSEEvent): string | null {
	const templates = EVENT_MESSAGE_TEMPLATES[event.type];
	if (!templates) {
		return null;
	}

	const username = (event.payload?.username as string) || "Someone";
	const elementName = getElementName(event);
	const [withElement, withoutElement] = templates;

	const action = elementName
		? withElement.replace("{element}", elementName)
		: withoutElement;

	return `${username} ${action}`;
}

/**
 * Shows a toast notification for an SSE event.
 */
function showEventToast(event: SSEEvent): void {
	const message = buildToastMessage(event);
	if (message) {
		toastInfo(message, { duration: 4000 });
	}
}

const CaseContainer = ({ caseId }: CaseContainerProps) => {
	const [loading, setLoading] = useState(true);
	const { assuranceCase, setAssuranceCase, setOrphanedElements } = useStore();
	const { setCaseId: setHistoryCaseId } = useHistoryStore();
	const [open, setOpen] = useState(false);

	const params = useParams();
	const router = useRouter();
	const { caseId: paramsCaseId } = params;

	const { data: session } = useSession();

	// Debounce refs for SSE-triggered refetches
	const refetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const orphanRefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Get the effective case ID
	const effectiveCaseId =
		caseId || (Array.isArray(paramsCaseId) ? paramsCaseId[0] : paramsCaseId);

	// Update history store when case changes (clears history if different case)
	useEffect(() => {
		if (effectiveCaseId) {
			setHistoryCaseId(effectiveCaseId);
		}
	}, [effectiveCaseId, setHistoryCaseId]);

	// Fetch a single case by ID
	const fetchSingleCase = useCallback(
		async (id: number | string) => {
			try {
				const response = await fetch(`/api/cases/${id}`);

				if (response.status === 401) {
					router.replace("/login");
					return null;
				}

				if (!response.ok) {
					return null;
				}

				const result = await response.json();
				return addHiddenProp(result) as AssuranceCase;
			} catch (_error) {
				toastError("Failed to load case data");
				return null;
			}
		},
		[router]
	);

	// Fetch orphaned elements for the case
	const fetchOrphanedElements = useCallback(
		async (id: string | number) => {
			try {
				const response = await fetch(`/api/cases/${id}/sandbox`);

				if (response.status === 404 || response.status === 403) {
					return;
				}

				if (response.status === 401) {
					router.replace("/login");
					return null;
				}

				const result = await response.json();
				return result;
			} catch (_error) {
				toastError("Failed to load sandbox elements");
				return [];
			}
		},
		[router]
	);

	// Load orphaned elements data
	const loadOrphanedElementsData = useCallback(async () => {
		const id = caseId || paramsCaseId;
		if (!id) {
			return;
		}

		const idValue = Array.isArray(id) ? (id[0] ?? "") : id;
		try {
			const result = await fetchOrphanedElements(idValue);
			setOrphanedElements(result || []);
		} catch {
			setOrphanedElements([]);
		}
	}, [caseId, paramsCaseId, fetchOrphanedElements, setOrphanedElements]);

	// Refetch case data for real-time updates
	const refetchCase = useCallback(() => {
		if (!effectiveCaseId) {
			return;
		}
		fetchAndRefreshCase(effectiveCaseId).then((result) => {
			if (result) {
				setAssuranceCase(result);
			}
		});
	}, [effectiveCaseId, setAssuranceCase]);

	// Debounced versions to prevent rapid-fire API calls from multiple SSE events
	const debouncedRefetchCase = useCallback(() => {
		if (refetchTimeoutRef.current) {
			clearTimeout(refetchTimeoutRef.current);
		}
		refetchTimeoutRef.current = setTimeout(() => refetchCase(), 300);
	}, [refetchCase]);

	const debouncedOrphanRefetch = useCallback(() => {
		if (orphanRefetchTimeoutRef.current) {
			clearTimeout(orphanRefetchTimeoutRef.current);
		}
		orphanRefetchTimeoutRef.current = setTimeout(
			() => loadOrphanedElementsData(),
			300
		);
	}, [loadOrphanedElementsData]);

	// Clean up debounce timeouts on unmount
	useEffect(
		() => () => {
			if (refetchTimeoutRef.current) {
				clearTimeout(refetchTimeoutRef.current);
			}
			if (orphanRefetchTimeoutRef.current) {
				clearTimeout(orphanRefetchTimeoutRef.current);
			}
		},
		[]
	);

	// Subscribe to real-time case events via SSE
	useCaseEvents({
		caseId: effectiveCaseId || "",
		enabled: Boolean(effectiveCaseId) && !loading,
		onEvent: (event) => {
			// Suppress toasts for self-events (acting user)
			const isSelfEvent = event.userId && event.userId === session?.user?.id;
			if (!isSelfEvent) {
				showEventToast(event);
			}

			// Refetch case data for element/case events
			if (REFETCH_EVENTS.includes(event.type)) {
				debouncedRefetchCase();
				if (ORPHAN_REFETCH_EVENTS.includes(event.type)) {
					debouncedOrphanRefetch();
				}
			}
		},
	});

	// Initial case load
	useEffect(() => {
		const loadCase = async () => {
			const id = caseId || paramsCaseId;
			if (id) {
				try {
					const idValue = Array.isArray(id) ? (id[0] ?? "") : id;
					const result = await fetchSingleCase(idValue);
					setAssuranceCase((result as AssuranceCase) || null);
					setLoading(false);
				} catch {
					setLoading(false);
				}
			}
		};

		loadCase();
	}, [caseId, paramsCaseId, fetchSingleCase, setAssuranceCase]);

	// Initial orphaned elements load
	useEffect(() => {
		loadOrphanedElementsData();
	}, [loadOrphanedElementsData]);

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="flex flex-col items-center justify-center gap-2">
					<Loader2 className="h-8 w-8 animate-spin" />
					<p className="text-muted-foreground">Rendering your chart...</p>
				</div>
			</div>
		);
	}

	if (assuranceCase) {
		return (
			<ReactFlowProvider>
				<CheckTourClient
					enabled={!loading}
					tourId={assuranceCase?.isDemo ? "demo-case" : "case-canvas"}
				/>
				<Header setOpen={setOpen} />
				<ErrorBoundary
					fallback={
						<div className="flex min-h-screen items-center justify-center text-muted-foreground">
							<p>Diagram failed to render. Try refreshing.</p>
						</div>
					}
				>
					<Flow />
				</ErrorBoundary>
				<CaseDetails isOpen={open} setOpen={setOpen} />
			</ReactFlowProvider>
		);
	}

	return (
		<div className="flex min-h-[60vh] items-center justify-center px-4">
			<ErrorCard
				message="We couldn't find this case. It may have been deleted or you may not have permission to view it."
				showDashboardLink
				title="Case not found"
			/>
		</div>
	);
};

export default CaseContainer;

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { Node } from "reactflow";
import type { ReactFlowNode } from "@/lib/case";
import {
	addEvidenceToClaim,
	addPropertyClaimToNested,
	createAssuranceCaseNode,
	findParentNode,
	findSiblingHiddenState,
} from "@/lib/case";
import {
	type NodeEditFormInput,
	nodeEditFormSchema,
} from "@/lib/schemas/element";
import type {
	AssuranceCaseResponse,
	EvidenceResponse,
	GoalResponse,
	PropertyClaimResponse,
} from "@/lib/services/case-response-types";
import { recordCreate } from "@/lib/services/history-service";
import { toast } from "@/lib/toast";
import useStore from "@/store/store";

interface UseNewLinkFormProps {
	actions: {
		setSelectedLink: (value: boolean) => void;
		setLinkToCreate: (value: string) => void;
		handleClose: () => void;
	};
	linkType: string;
	node: Node;
	setUnresolvedChanges: Dispatch<SetStateAction<boolean>>;
}

interface UseNewLinkFormReturn {
	append: ReturnType<typeof useFieldArray<NodeEditFormInput, "urls">>["append"];
	fields: ReturnType<typeof useFieldArray<NodeEditFormInput, "urls">>["fields"];
	form: ReturnType<typeof useForm<NodeEditFormInput>>;
	loading: boolean;
	onSubmit: (values: NodeEditFormInput) => void;
	remove: ReturnType<typeof useFieldArray<NodeEditFormInput, "urls">>["remove"];
}

export function useNewLinkForm({
	node,
	linkType,
	actions,
	setUnresolvedChanges,
}: UseNewLinkFormProps): UseNewLinkFormReturn {
	const { nodes, assuranceCase, setAssuranceCase } = useStore();
	const { data: session } = useSession();
	const [loading, setLoading] = useState<boolean>(false);

	const { setSelectedLink, setLinkToCreate, handleClose } = actions;

	const _parentNode = findParentNode(
		nodes as ReactFlowNode[],
		node as ReactFlowNode
	);

	const reset = () => {
		setLinkToCreate("");
		setSelectedLink(false);
		handleClose();
	};

	const topGoalId = assuranceCase?.goals?.[0]?.id ?? null;

	/**
	 * A goal card other than the case's top goal: a counter-goal. What is added
	 * from it belongs to that goal, not to the top goal. The optimistic updates
	 * below only extend the top goal, so for a counter-goal the refetch that
	 * follows the live update places the new element.
	 */
	const isCounterGoalCard =
		node.type === "goal" && (node.data.id as string) !== topGoalId;

	/** The element a new strategy attaches to: the card's own goal or claim. */
	const strategyParentId = () =>
		node.type === "property" || node.type === "goal"
			? (node.data.id as string)
			: topGoalId;

	/** Builds the strategy creation payload based on the parent node type */
	const createStrategyPayload = (description: string) => {
		const parentId = strategyParentId();
		return {
			description,
			parentId,
			assuranceCaseId: assuranceCase?.id,
		};
	};

	/** Optimistically adds a new strategy to the goal's strategies in state */
	const updateGoalWithStrategy = (strategyData: unknown) => {
		const newStrategy = [
			...(assuranceCase?.goals?.[0]?.strategies || []),
			strategyData,
		].filter(Boolean);

		const updatedAssuranceCase = assuranceCase
			? {
					...assuranceCase,
					goals: [
						{
							...(assuranceCase.goals?.[0] || {}),
							strategies: newStrategy,
						} as GoalResponse,
					],
				}
			: null;

		if (updatedAssuranceCase) {
			setAssuranceCase(updatedAssuranceCase as AssuranceCaseResponse);
		}
	};

	/** Handles creation of a strategy node linked to a goal or property claim */
	const handleStrategyAdd = async (description: string) => {
		const parentId = strategyParentId();

		if (!(parentId && session?.user?.id)) {
			setLoading(false);
			return;
		}

		const result = await createAssuranceCaseNode(
			"strategies",
			createStrategyPayload(description),
			""
		);

		if (result.error) {
			toast({
				variant: "destructive",
				title: "Error",
				description: "Failed to create strategy",
			});
			setLoading(false);
			return;
		}

		if (result.data && assuranceCase) {
			result.data.hidden = findSiblingHiddenState(assuranceCase, node.data.id);
			recordCreate(result.data.id, "strategy", result.data);
		}

		// Optimistic update: for top-goal strategies, update state directly.
		// For strategies under property claims or counter-goals, the SSE event
		// triggers a full case refetch that places the strategy correctly in the
		// nested tree.
		if (node.type !== "property" && !isCounterGoalCard) {
			updateGoalWithStrategy(result.data);
		}

		reset();
		setLoading(false);
	};

	/** Builds the property claim payload based on the parent node type */
	const createPropertyClaimItem = (description: string) => {
		const baseItem = {
			description,
			assuranceCaseId: assuranceCase?.id,
		};

		switch (node.type) {
			case "strategy":
			case "property":
			case "goal":
				return { ...baseItem, parentId: node.data.id as string };
			default:
				return {
					...baseItem,
					parentId: topGoalId,
				};
		}
	};

	/**
	 * Updates assurance case state when a claim belongs to a strategy or to
	 * another claim. The parent is looked for wherever it sits in the case,
	 * including beneath a counter-goal.
	 */
	const addClaimBeneathParent = (
		newClaim: PropertyClaimResponse | undefined,
		parentId: string | null | undefined
	): void => {
		if (!(assuranceCase?.goals && newClaim && parentId)) {
			return;
		}

		const goalsClone: GoalResponse[] = JSON.parse(
			JSON.stringify(assuranceCase.goals)
		);

		if (addPropertyClaimToNested(goalsClone, parentId, newClaim)) {
			setAssuranceCase({ ...assuranceCase, goals: goalsClone });
		}
	};

	/** Updates assurance case state when a claim belongs directly to a goal */
	const handleGoalClaimUpdate = (result: { data: PropertyClaimResponse }) => {
		const newPropertyClaim = [
			...(assuranceCase?.goals?.[0]?.propertyClaims || []),
			result.data,
		];

		const updatedAssuranceCase = assuranceCase
			? {
					...assuranceCase,
					goals: [
						{
							...(assuranceCase.goals?.[0] || {}),
							propertyClaims: newPropertyClaim,
						} as GoalResponse,
					],
				}
			: null;

		if (updatedAssuranceCase) {
			setAssuranceCase(updatedAssuranceCase as AssuranceCaseResponse);
		}
	};

	/** Routes claim result to the correct state update helper */
	const processClaimResult = (
		result: { data?: unknown; error?: unknown },
		nodeType: string
	): void => {
		const claim = result.data as PropertyClaimResponse | undefined;
		if (nodeType === "strategy") {
			addClaimBeneathParent(claim, claim?.strategyId);
		} else if (nodeType === "property") {
			addClaimBeneathParent(claim, claim?.propertyClaimId);
		} else if (nodeType === "goal" && !isCounterGoalCard) {
			handleGoalClaimUpdate(result as { data: PropertyClaimResponse });
		}
	};

	/** Handles creation of a property claim linked to a goal, strategy, or nested claim */
	const handleClaimAdd = async (description: string) => {
		const newPropertyClaimItem = createPropertyClaimItem(description);

		const result = await createAssuranceCaseNode(
			"propertyclaims",
			newPropertyClaimItem,
			""
		);

		if (result.error) {
			toast({
				variant: "destructive",
				title: "Error",
				description: "Failed to create claim",
			});
			setLoading(false);
			return;
		}

		if (result.data && assuranceCase) {
			(result.data as { hidden?: boolean }).hidden = findSiblingHiddenState(
				assuranceCase,
				node.data.id
			);
			recordCreate(
				result.data.id as string | number,
				"property_claim",
				result.data as Record<string, unknown>
			);
		}

		processClaimResult(result, node.type ?? "");

		reset();
		setLoading(false);
	};

	/**
	 * Builds the defeater creation payload (ADR 0005 D7): a PROPERTY_CLAIM
	 * child of the element the "Add defeater" menu was opened on, flagged
	 * `isDefeater` with `defeatsElementId` pointing at that same element.
	 */
	const createDefeaterPayload = (description: string) => ({
		description,
		assuranceCaseId: assuranceCase?.id,
		parentId: node.data.id as string,
		isDefeater: true,
		defeatsElementId: node.data.id as string,
	});

	/**
	 * Handles creation of a defeater (ADR 0005 D7). A defeater is an ordinary
	 * property claim in the tree — shares the claim result-routing helpers
	 * above — with the two extra fields the write path already accepts.
	 */
	const handleDefeaterAdd = async (description: string) => {
		const result = await createAssuranceCaseNode(
			"propertyclaims",
			createDefeaterPayload(description),
			""
		);

		if (result.error) {
			// Surface the server's own validation message verbatim — a generic
			// "cannot create …" line hid the real reason (walkthrough finding 7).
			const errorMessage =
				typeof result.error === "string"
					? result.error
					: "Failed to create defeater";
			toast({
				variant: "destructive",
				title: "Error",
				description: errorMessage,
			});
			setLoading(false);
			return;
		}

		if (result.data && assuranceCase) {
			(result.data as { hidden?: boolean }).hidden = findSiblingHiddenState(
				assuranceCase,
				node.data.id
			);
			recordCreate(
				result.data.id as string | number,
				"property_claim",
				result.data as Record<string, unknown>
			);
		}

		processClaimResult(result, node.type ?? "");

		reset();
		setLoading(false);
	};

	/** Shows a destructive toast and resets loading state on evidence errors */
	const handleEvidenceError = (message: string) => {
		toast({
			variant: "destructive",
			title: "Error creating evidence",
			description: message,
		});
		setLoading(false);
	};

	/** Builds the evidence payload */
	const createEvidenceData = (description: string, urls: string[]) => ({
		description,
		urls,
		URL: urls[0] || "",
		parentId: node.data.id as string,
		assuranceCaseId: assuranceCase?.id,
	});

	/** Updates assurance case state with a modified goals structure */
	const updateAssuranceCaseWithModifiedGoals = (
		modifiedGoals: GoalResponse[]
	) => {
		if (!assuranceCase) {
			return;
		}

		setAssuranceCase({
			...assuranceCase,
			goals: modifiedGoals,
		} as AssuranceCaseResponse);
	};

	/** Handles creation of an evidence node linked to a property claim */
	const handleEvidenceAdd = async (description: string, urls: string[]) => {
		const newEvidenceItem = createEvidenceData(description, urls);

		const result = await createAssuranceCaseNode(
			"evidence",
			newEvidenceItem,
			""
		);

		if (result.error) {
			const errorMessage =
				typeof result.error === "string"
					? result.error
					: "Failed to create evidence. Please try again.";
			handleEvidenceError(errorMessage);
			return;
		}

		if (!result.data) {
			handleEvidenceError("No data returned from server.");
			return;
		}

		if (assuranceCase) {
			(result.data as { hidden?: boolean }).hidden = findSiblingHiddenState(
				assuranceCase,
				node.data.id
			);
		}

		recordCreate(
			result.data.id as string | number,
			"evidence",
			result.data as Record<string, unknown>
		);

		const evidenceData = result.data as unknown as EvidenceResponse;
		const parentClaimId = evidenceData?.propertyClaimId?.[0] || "";

		const goalsClone: GoalResponse[] = JSON.parse(
			JSON.stringify(assuranceCase?.goals || [])
		);

		const added = addEvidenceToClaim(goalsClone, parentClaimId, evidenceData);

		if (!added) {
			handleEvidenceError("Could not find the parent property claim.");
			return;
		}

		updateAssuranceCaseWithModifiedGoals(goalsClone);
		reset();
		setLoading(false);
	};

	const form = useForm<NodeEditFormInput>({
		resolver: zodResolver(nodeEditFormSchema),
		defaultValues: {
			description: "",
			urls: [{ value: "" }],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "urls",
	});

	function onSubmit(values: NodeEditFormInput) {
		setLoading(true);
		const description = values.description as string;

		switch (linkType) {
			case "claim":
				handleClaimAdd(description);
				break;
			case "strategy":
				handleStrategyAdd(description);
				break;
			case "defeater":
				handleDefeaterAdd(description);
				break;
			case "evidence": {
				const urlValues = values.urls
					.map((u) => u.value.trim())
					.filter((url) => url.length > 0);
				handleEvidenceAdd(description, urlValues);
				break;
			}
			default:
				setLoading(false);
				break;
		}
	}

	useEffect(() => {
		const subscription = form.watch((_values, { name }) => {
			if (name?.startsWith("urls") || name === "description") {
				setUnresolvedChanges(true);
			}
		});
		return () => subscription.unsubscribe();
	}, [form, setUnresolvedChanges]);

	return { form, fields, append, remove, loading, onSubmit };
}

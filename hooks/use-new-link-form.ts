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
import { toast } from "@/lib/toast";
import useStore from "@/store/store";
import type {
	AssuranceCase,
	Evidence,
	Goal,
	PropertyClaim,
	Strategy,
} from "@/types";

type UseNewLinkFormProps = {
	node: Node;
	linkType: string;
	actions: {
		setSelectedLink: (value: boolean) => void;
		setLinkToCreate: (value: string) => void;
		handleClose: () => void;
	};
	setUnresolvedChanges: Dispatch<SetStateAction<boolean>>;
};

type UseNewLinkFormReturn = {
	form: ReturnType<typeof useForm<NodeEditFormInput>>;
	fields: ReturnType<typeof useFieldArray<NodeEditFormInput, "urls">>["fields"];
	append: ReturnType<typeof useFieldArray<NodeEditFormInput, "urls">>["append"];
	remove: ReturnType<typeof useFieldArray<NodeEditFormInput, "urls">>["remove"];
	loading: boolean;
	onSubmit: (values: NodeEditFormInput) => void;
};

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

	/** Handles creation of a context node linked to a goal */
	const handleContextAdd = async (description: string) => {
		const newContextItem = {
			description,
			goalId: assuranceCase?.goals?.[0]?.id || 0,
			assuranceCaseId: assuranceCase?.id,
			type: "context",
		};

		const result = await createAssuranceCaseNode(
			"contexts",
			newContextItem,
			""
		);

		if (result.error) {
			toast({
				variant: "destructive",
				title: "Error",
				description: "Failed to create context",
			});
			return;
		}

		if (result.data && assuranceCase) {
			result.data.hidden = findSiblingHiddenState(assuranceCase, node.data.id);
		}

		const newContext = [
			...(assuranceCase?.goals?.[0]?.context || []),
			result.data,
		].filter(Boolean);

		const updatedAssuranceCase = assuranceCase
			? {
					...assuranceCase,
					goals: [
						{
							...(assuranceCase.goals?.[0] || {}),
							context: newContext,
						} as Goal,
					],
				}
			: null;

		if (updatedAssuranceCase) {
			setAssuranceCase(updatedAssuranceCase as AssuranceCase);
		}
		reset();
		setLoading(false);
	};

	/** Handles creation of a strategy node linked to a goal */
	const handleStrategyAdd = async (description: string) => {
		if (!assuranceCase?.goals?.[0]?.id) {
			setLoading(false);
			return;
		}

		if (!session?.user?.id) {
			setLoading(false);
			return;
		}

		const newStrategyItem = {
			description,
			goalId: assuranceCase.goals[0].id,
			assuranceCaseId: assuranceCase.id,
		};

		const result = await createAssuranceCaseNode(
			"strategies",
			newStrategyItem,
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
		}

		const newStrategy = [
			...(assuranceCase?.goals?.[0]?.strategies || []),
			result.data,
		].filter(Boolean);

		const updatedAssuranceCase = assuranceCase
			? {
					...assuranceCase,
					goals: [
						{
							...(assuranceCase.goals?.[0] || {}),
							strategies: newStrategy,
						} as Goal,
					],
				}
			: null;

		if (updatedAssuranceCase) {
			setAssuranceCase(updatedAssuranceCase as AssuranceCase);
		}
		reset();
		setLoading(false);
	};

	/** Builds the property claim payload based on the parent node type */
	const createPropertyClaimItem = (description: string) => {
		const baseItem = {
			description,
			claimType: "Property Claim",
			propertyClaims: [],
			evidence: [],
			type: "property_claim",
			assuranceCaseId: assuranceCase?.id,
		};

		switch (node.type) {
			case "strategy":
				return { ...baseItem, strategyId: node.data.id };
			case "property":
				return { ...baseItem, propertyClaimId: node.data.id };
			default:
				return { ...baseItem, goalId: assuranceCase?.goals?.[0]?.id || 0 };
		}
	};

	/** Updates assurance case state when a claim belongs to a strategy */
	const handleStrategyClaimUpdate = (result: {
		data: PropertyClaim;
		error?: unknown;
	}) => {
		if (!assuranceCase?.goals) {
			return false;
		}
		const goalContainingStrategy = assuranceCase.goals.find((goal) =>
			goal.strategies?.some(
				(strategy) => strategy.id === result.data.strategyId
			)
		);

		if (!goalContainingStrategy) {
			return false;
		}

		const updatedStrategies = goalContainingStrategy.strategies.map(
			(strategy) => {
				if (strategy.id === result.data.strategyId) {
					return {
						...strategy,
						propertyClaims: [...(strategy.propertyClaims || []), result.data],
					};
				}
				return strategy;
			}
		);

		const updatedGoalContainingStrategy = {
			...goalContainingStrategy,
			strategies: updatedStrategies,
		};

		const updatedAssuranceCase = {
			...assuranceCase,
			goals: (assuranceCase.goals || []).map((goal) => {
				if (goal === goalContainingStrategy) {
					return updatedGoalContainingStrategy;
				}
				return goal;
			}),
		};

		setAssuranceCase(updatedAssuranceCase);
		return true;
	};

	/** Updates assurance case state when a claim belongs directly to a goal */
	const handleGoalClaimUpdate = (result: { data: PropertyClaim }) => {
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
						} as Goal,
					],
				}
			: null;

		if (updatedAssuranceCase) {
			setAssuranceCase(updatedAssuranceCase as AssuranceCase);
		}
	};

	/** Routes claim result to the correct state update helper */
	const processClaimResult = (
		result: { data?: unknown; error?: unknown },
		nodeType: string
	): void => {
		if (nodeType === "strategy") {
			handleStrategyClaimUpdate(
				result as { data: PropertyClaim; error?: unknown }
			);
		} else if (nodeType === "property") {
			handlePropertyClaim(result);
		} else if (nodeType === "goal") {
			handleGoalClaimUpdate(result as { data: PropertyClaim });
		}
	};

	/** Searches strategies' property claims for a parent claim */
	const findAndAddClaimInStrategies = (
		strategies: Strategy[],
		parentId: number,
		newClaim: PropertyClaim
	): boolean => {
		for (const strategy of strategies) {
			const strategyPropertyClaims = strategy.propertyClaims || [];
			const found = addPropertyClaimToNested(
				strategyPropertyClaims,
				parentId,
				newClaim
			);
			if (found) {
				return true;
			}
		}
		return false;
	};

	/** Updates assurance case state for a nested property claim */
	const handlePropertyClaim = (result: {
		data?: unknown;
		error?: unknown;
	}): void => {
		if (!assuranceCase?.goals) {
			return;
		}

		const goalsClone: Goal[] = JSON.parse(JSON.stringify(assuranceCase.goals));
		const parentId = (result.data as PropertyClaim)?.propertyClaimId || 0;
		const newClaim = (result.data as PropertyClaim) || ({} as PropertyClaim);

		const goalPropertyClaims = goalsClone[0]?.propertyClaims || [];
		const strategies = goalsClone[0]?.strategies || [];

		const added =
			addPropertyClaimToNested(goalPropertyClaims, parentId, newClaim) ||
			findAndAddClaimInStrategies(strategies, parentId, newClaim);

		if (!added) {
			return;
		}

		setAssuranceCase({ ...assuranceCase, goals: goalsClone });
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
			return;
		}

		if (result.data && assuranceCase) {
			(result.data as { hidden?: boolean }).hidden = findSiblingHiddenState(
				assuranceCase,
				node.data.id
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
		propertyClaimId: [node.data.id],
		type: "evidence",
		assuranceCaseId: assuranceCase?.id,
	});

	/** Searches strategies' property claims for a claim to attach evidence to */
	const checkPropertyClaimsInStrategies = (
		strategies: Strategy[] | undefined,
		parentClaimId: number,
		evidence: Evidence
	): boolean => {
		if (!strategies) {
			return false;
		}

		return strategies.some(
			(strategy) =>
				strategy.propertyClaims &&
				addEvidenceToClaim(strategy.propertyClaims, parentClaimId, evidence)
		);
	};

	/** Searches a single goal's property claims (direct and via strategies) */
	const checkPropertyClaimsInGoal = (
		goal: Goal,
		parentClaimId: number,
		evidence: Evidence
	): boolean => {
		if (
			goal.propertyClaims &&
			addEvidenceToClaim(goal.propertyClaims, parentClaimId, evidence)
		) {
			return true;
		}

		return checkPropertyClaimsInStrategies(
			goal.strategies,
			parentClaimId,
			evidence
		);
	};

	/** Searches all goals to find the claim and attach evidence */
	const addEvidenceToGoals = (
		goals: Goal[],
		parentClaimId: number,
		evidence: Evidence
	): boolean =>
		goals.some((goal) =>
			checkPropertyClaimsInGoal(goal, parentClaimId, evidence)
		);

	/** Updates assurance case state with a modified goals structure */
	const updateAssuranceCaseWithModifiedGoals = (modifiedGoals: Goal[]) => {
		if (!assuranceCase) {
			return;
		}

		setAssuranceCase({
			...assuranceCase,
			goals: modifiedGoals,
		} as AssuranceCase);
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

		const evidenceData = result.data as unknown as Evidence;
		const parentClaimId = evidenceData?.propertyClaimId?.[0] || 0;

		const goalsClone = JSON.parse(JSON.stringify(assuranceCase?.goals || []));

		const added = addEvidenceToGoals(goalsClone, parentClaimId, evidenceData);

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
			case "context":
				handleContextAdd(description);
				break;
			case "claim":
				handleClaimAdd(description);
				break;
			case "strategy":
				handleStrategyAdd(description);
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

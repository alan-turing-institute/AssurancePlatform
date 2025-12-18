"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import type React from "react";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { Node } from "reactflow";
import { z } from "zod";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import useStore from "@/data/store";
import type { ReactFlowNode } from "@/lib/case";
// import { useLoginToken } from '.*/use-auth'
import {
	addEvidenceToClaim,
	addPropertyClaimToNested,
	createAssuranceCaseNode,
	findParentNode,
	findSiblingHiddenState,
} from "@/lib/case";
import { useToast } from "@/lib/toast";
import type {
	AssuranceCase,
	Evidence,
	Goal,
	PropertyClaim,
	Strategy,
} from "@/types";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

const formSchema = z.object({
	description: z.string().min(2, {
		message: "Description must be atleast 2 characters",
	}),
	URL: z
		.string()
		.min(2, {
			message: "url must be at least 2 characters.",
		})
		.or(z.literal(""))
		.optional(),
});

type NodeActions = {
	setSelectedLink: (value: boolean) => void;
	setLinkToCreate: (value: string) => void;
	handleClose: () => void;
};

type NewLinkFormProps = {
	node: Node;
	linkType: string;
	actions: NodeActions;
	setUnresolvedChanges: Dispatch<SetStateAction<boolean>>;
};

const NewLinkForm: React.FC<NewLinkFormProps> = ({
	node,
	linkType,
	actions,
	setUnresolvedChanges,
}) => {
	const { nodes, assuranceCase, setAssuranceCase } = useStore();
	// const [token] = useLoginToken();
	const { data: session } = useSession();
	const { toast } = useToast();
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

	/** Function used to handle creation of a context node linked to a goal */
	const handleContextAdd = async (description: string) => {
		// Create a new context object to add - this should be created by calling the api
		const newContextItem = {
			short_description: description,
			long_description: description,
			goal_id: assuranceCase?.goals?.[0]?.id || 0,
			assurance_case_id: assuranceCase?.id,
			type: "Context",
		};

		const result = await createAssuranceCaseNode(
			"contexts",
			newContextItem,
			session?.key ?? ""
		);

		if (result.error) {
			// TODO: Rendering error
		}

		if (result.data && assuranceCase) {
			result.data.hidden = findSiblingHiddenState(assuranceCase, node.data.id);
		}

		// Create a new context array by adding the new context item
		const newContext = [
			...(assuranceCase?.goals?.[0]?.context || []),
			result.data,
		].filter(Boolean);

		// Create a new assuranceCase object with the updated context array
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

		// Update Assurance Case in state
		if (updatedAssuranceCase) {
			setAssuranceCase(updatedAssuranceCase as AssuranceCase);
		}
		reset();
		setLoading(false);
		// window.location.reload()
	};

	/** Function used to handle creation of a strategy node linked to a goal */
	const handleStrategyAdd = async (description: string) => {
		// Validate required data
		if (!assuranceCase?.goals?.[0]?.id) {
			setLoading(false);
			return;
		}

		if (!session?.key) {
			setLoading(false);
			return;
		}

		// Create a new strategy object to add
		const newStrategyItem = {
			short_description: description,
			long_description: description,
			goal_id: assuranceCase.goals[0].id,
			assurance_case_id: assuranceCase.id,
		};

		const result = await createAssuranceCaseNode(
			"strategies",
			newStrategyItem,
			session.key
		);

		if (result.error) {
			setLoading(false);
			return;
		}

		if (result.data && assuranceCase) {
			result.data.hidden = findSiblingHiddenState(assuranceCase, node.data.id);
		}

		// Create a new strategy array by adding the new context item
		const newStrategy = [
			...(assuranceCase?.goals?.[0]?.strategies || []),
			result.data,
		].filter(Boolean);

		// Create a new assuranceCase object with the updated strategy array
		const updatedAssuranceCase = assuranceCase
			? {
					...assuranceCase,
					goals: [
						{
							...(assuranceCase.goals?.[0] || {}),
							strategies: newStrategy,
						} as Goal,
						// Copy other goals if needed
					],
				}
			: null;

		// Update Assurance Case in state
		if (updatedAssuranceCase) {
			setAssuranceCase(updatedAssuranceCase as AssuranceCase);
		}
		reset();
		setLoading(false);
		// window.location.reload()
	};

	/** Helper function to create property claim item */
	const createPropertyClaimItem = (description: string) => {
		const baseItem = {
			short_description: description,
			long_description: description,
			claim_type: "Property Claim",
			property_claims: [],
			evidence: [],
			type: "PropertyClaim",
			assurance_case_id: assuranceCase?.id,
		};

		switch (node.type) {
			case "strategy":
				return { ...baseItem, strategy_id: node.data.id };
			case "property":
				return { ...baseItem, property_claim_id: node.data.id };
			default:
				return { ...baseItem, goal_id: assuranceCase?.goals?.[0]?.id || 0 };
		}
	};

	/** Helper function to handle strategy claim updates */
	const handleStrategyClaimUpdate = (result: {
		data: PropertyClaim;
		error?: unknown;
	}) => {
		if (!assuranceCase?.goals) {
			return false;
		}
		const goalContainingStrategy = assuranceCase.goals.find((goal) =>
			goal.strategies?.some(
				(strategy) => strategy.id === result.data.strategy_id
			)
		);

		if (!goalContainingStrategy) {
			return false;
		}

		const updatedStrategies = goalContainingStrategy.strategies.map(
			(strategy) => {
				if (strategy.id === result.data.strategy_id) {
					return {
						...strategy,
						property_claims: [...(strategy.property_claims || []), result.data],
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

	/** Helper function to handle goal claim updates */
	const handleGoalClaimUpdate = (result: { data: PropertyClaim }) => {
		const newPropertyClaim = [
			...(assuranceCase?.goals?.[0]?.property_claims || []),
			result.data,
		];

		const updatedAssuranceCase = assuranceCase
			? {
					...assuranceCase,
					goals: [
						{
							...(assuranceCase.goals?.[0] || {}),
							property_claims: newPropertyClaim,
						} as Goal,
					],
				}
			: null;

		if (updatedAssuranceCase) {
			setAssuranceCase(updatedAssuranceCase as AssuranceCase);
		}
	};

	/** Helper function to process claim creation result */
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

	/** Helper to search for parent claim in strategies */
	const findAndAddClaimInStrategies = (
		strategies: Strategy[],
		parentId: number,
		newClaim: PropertyClaim
	): boolean => {
		for (const strategy of strategies) {
			const strategyPropertyClaims = strategy.property_claims || [];
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

	/** Helper function to handle property claim updates */
	const handlePropertyClaim = (result: {
		data?: unknown;
		error?: unknown;
	}): void => {
		if (!assuranceCase?.goals) {
			return;
		}

		// Deep clone the entire goals structure to ensure React detects the state change
		const goalsClone: Goal[] = JSON.parse(JSON.stringify(assuranceCase.goals));
		const parentId = (result.data as PropertyClaim)?.property_claim_id || 0;
		const newClaim = (result.data as PropertyClaim) || ({} as PropertyClaim);

		// First try goal's direct property claims, then strategies' property claims
		const goalPropertyClaims = goalsClone[0]?.property_claims || [];
		const strategies = goalsClone[0]?.strategies || [];

		const added =
			addPropertyClaimToNested(goalPropertyClaims, parentId, newClaim) ||
			findAndAddClaimInStrategies(strategies, parentId, newClaim);

		if (!added) {
			return;
		}

		setAssuranceCase({ ...assuranceCase, goals: goalsClone });
	};

	/** Function used to create a property claim, whether its parent is a goal, strategy or another propery claim */
	const handleClaimAdd = async (description: string) => {
		const newPropertyClaimItem = createPropertyClaimItem(description);

		const result = await createAssuranceCaseNode(
			"propertyclaims",
			newPropertyClaimItem,
			session?.key ?? ""
		);

		if (result.error) {
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

	/** Helper function to show error toast and set loading false */
	const handleEvidenceError = (message: string) => {
		toast({
			variant: "destructive",
			title: "Error creating evidence",
			description: message,
		});
		setLoading(false);
	};

	/** Helper function to create evidence data object */
	const createEvidenceData = (description: string, url?: string) => ({
		short_description: description,
		long_description: description,
		URL: url || "",
		property_claim_id: [node.data.id],
		type: "Evidence",
		assurance_case_id: assuranceCase?.id,
	});

	/** Helper function to check property claims in strategies */
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
				strategy.property_claims &&
				addEvidenceToClaim(strategy.property_claims, parentClaimId, evidence)
		);
	};

	/** Helper function to check property claims in a single goal */
	const checkPropertyClaimsInGoal = (
		goal: Goal,
		parentClaimId: number,
		evidence: Evidence
	): boolean => {
		// Check direct property claims
		if (
			goal.property_claims &&
			addEvidenceToClaim(goal.property_claims, parentClaimId, evidence)
		) {
			return true;
		}

		// Check property claims in strategies
		return checkPropertyClaimsInStrategies(
			goal.strategies,
			parentClaimId,
			evidence
		);
	};

	/** Helper function to add evidence to goals structure */
	const addEvidenceToGoals = (
		goals: Goal[],
		parentClaimId: number,
		evidence: Evidence
	): boolean => {
		// Search through all goals for the property claim
		return goals.some((goal) =>
			checkPropertyClaimsInGoal(goal, parentClaimId, evidence)
		);
	};

	/** Helper function to update assurance case with modified goals */
	const updateAssuranceCaseWithModifiedGoals = (modifiedGoals: Goal[]) => {
		if (!assuranceCase) {
			return;
		}

		const updatedAssuranceCase = {
			...assuranceCase,
			goals: modifiedGoals,
		};

		setAssuranceCase(updatedAssuranceCase as AssuranceCase);
	};

	/** Function used to handle creation of a evidence node linked to a property claim */
	const handleEvidenceAdd = async (description: string, url?: string) => {
		const newEvidenceItem = createEvidenceData(description, url);

		const result = await createAssuranceCaseNode(
			"evidence",
			newEvidenceItem,
			session?.key ?? ""
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
		const parentClaimId = evidenceData?.property_claim_id?.[0] || 0;

		// Debug logging - uncomment for troubleshooting
		// const allPropertyClaims = assuranceCase?.goals
		// 	? extractGoalsClaimsStrategies(assuranceCase.goals).claims
		// 	: [];
		// console.log("Creating evidence for node:", node.data);
		// console.log("Evidence data from server:", evidenceData);
		// console.log("Looking for parent claim ID:", parentClaimId);
		// console.log(
		// 	"All property claims found:",
		// 	allPropertyClaims.map((c) => ({ id: c.id, name: c.name }))
		// );

		// Deep clone the entire goals structure to ensure we can modify nested claims
		const goalsClone = JSON.parse(JSON.stringify(assuranceCase?.goals || []));

		// Add evidence to the appropriate claim in the cloned structure
		const added = addEvidenceToGoals(goalsClone, parentClaimId, evidenceData);

		if (!added) {
			// console.error(
			// 	"Failed to find parent claim. Goals structure:",
			// 	goalsClone
			// );
			handleEvidenceError("Could not find the parent property claim.");
			return;
		}

		// Update the assurance case with the modified goals
		updateAssuranceCaseWithModifiedGoals(goalsClone);
		reset();
		setLoading(false);
	};

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			description: "",
			URL: "", // Add empty string as default to prevent uncontrolled input error
		},
	});

	function onSubmit(values: z.infer<typeof formSchema>) {
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
			case "evidence":
				handleEvidenceAdd(description, values.URL || "");
				break;
			default:
				setLoading(false);
				break;
		}
	}

	useEffect(() => {
		form.watch((_values, { name }) => {
			if (name === "description" || name === "URL") {
				setUnresolvedChanges(true);
			}
		});
	}, [form, setUnresolvedChanges]);

	return (
		<div className="my-4 border-t">
			<div className="mt-4">
				Create new <span className="font-bold">{linkType}</span>.
			</div>
			<Form {...form}>
				<form className="mt-6 space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
					<FormField
						control={form.control}
						name="description"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Description</FormLabel>
								<FormControl>
									<Textarea
										placeholder="Type your description here."
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					{linkType === "evidence" && (
						<FormField
							control={form.control}
							name="URL"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Evidence URL</FormLabel>
									<FormControl>
										<Input placeholder="www.sample.com" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					)}
					<div className="flex items-center justify-start gap-3 pt-4">
						<Button
							className="bg-indigo-500 hover:bg-indigo-600 dark:text-white"
							disabled={loading}
							type="submit"
						>
							Add
						</Button>
						<Button
							onClick={() => {
								setSelectedLink(false);
								setLinkToCreate("");
							}}
							variant={"outline"}
						>
							Cancel
						</Button>
					</div>
				</form>
			</Form>
		</div>
	);
};

export default NewLinkForm;

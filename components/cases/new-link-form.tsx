"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Minus, Plus } from "lucide-react";
import { useSession } from "next-auth/react";
import type React from "react";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { Node } from "reactflow";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ReactFlowNode } from "@/lib/case";
// import { useLoginToken } from '.*/use-auth'
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
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

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
			description,
			goalId: assuranceCase?.goals?.[0]?.id || 0,
			assuranceCaseId: assuranceCase?.id,
			type: "Context",
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

		// Check user.id for JWT-only mode compatibility (key may not exist in JWT-only mode)
		if (!session?.user?.id) {
			setLoading(false);
			return;
		}

		// Create a new strategy object to add
		const newStrategyItem = {
			description,
			goalId: assuranceCase.goals[0].id,
			assuranceCaseId: assuranceCase.id,
		};

		// Pass empty string - server action uses validateSession() internally
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
			description,
			claimType: "Property Claim",
			propertyClaims: [],
			evidence: [],
			type: "PropertyClaim",
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

	/** Helper function to handle goal claim updates */
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
		const parentId = (result.data as PropertyClaim)?.propertyClaimId || 0;
		const newClaim = (result.data as PropertyClaim) || ({} as PropertyClaim);

		// First try goal's direct property claims, then strategies' property claims
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

	/** Function used to create a property claim, whether its parent is a goal, strategy or another propery claim */
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
	const createEvidenceData = (description: string, urls: string[]) => ({
		description,
		urls,
		URL: urls[0] || "", // Backward compatibility
		propertyClaimId: [node.data.id],
		type: "Evidence",
		assuranceCaseId: assuranceCase?.id,
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
				strategy.propertyClaims &&
				addEvidenceToClaim(strategy.propertyClaims, parentClaimId, evidence)
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
			goal.propertyClaims &&
			addEvidenceToClaim(goal.propertyClaims, parentClaimId, evidence)
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
				// Filter out empty URLs and extract values
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
						<div className="space-y-3">
							<FormLabel>Evidence Link(s) (Optional)</FormLabel>
							{fields.map((field, index) => (
								<FormField
									control={form.control}
									key={field.id}
									name={`urls.${index}.value`}
									render={({ field: inputField }) => (
										<FormItem>
											<div className="flex gap-2">
												<FormControl>
													<Input
														placeholder="URL, DOI, or reference"
														{...inputField}
													/>
												</FormControl>
												{fields.length > 1 && (
													<Button
														onClick={() => remove(index)}
														size="icon"
														type="button"
														variant="outline"
													>
														<Minus className="h-4 w-4" />
													</Button>
												)}
											</div>
											<FormMessage />
										</FormItem>
									)}
								/>
							))}
							<Button
								className="w-full"
								onClick={() => append({ value: "" })}
								type="button"
								variant="outline"
							>
								<Plus className="mr-2 h-4 w-4" />
								Add URL
							</Button>
						</div>
					)}
					<div className="flex items-center justify-start gap-3 pt-4">
						<Button
							className="bg-primary text-primary-foreground hover:bg-primary/90"
							disabled={loading}
							type="submit"
						>
							Add
						</Button>
						<Button onClick={reset} type="button" variant={"outline"}>
							Cancel
						</Button>
					</div>
				</form>
			</Form>
		</div>
	);
};

export default NewLinkForm;

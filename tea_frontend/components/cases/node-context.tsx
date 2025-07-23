"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FolderXIcon, Trash2 } from "lucide-react";
import moment from "moment";
import { useSession } from "next-auth/react";
import type React from "react";
import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useState,
} from "react";
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
import { toast } from "@/components/ui/use-toast";
import useStore from "@/data/store";
// import { useLoginToken } from '.*/use-auth'
import {
	createAssuranceCaseNode,
	deleteAssuranceCaseNode,
	getAssuranceCaseNode,
	removeAssuranceCaseNode,
} from "@/lib/case-helper";
import type { AssuranceCase, Context, Goal } from "@/types";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { Textarea } from "../ui/textarea";

const formSchema = z.object({
	description: z
		.string()
		.min(2, {
			message: "Description must be atleast 2 characters",
		})
		.optional(),
});

interface NodeActions {
	setSelectedLink: (value: boolean) => void;
	setLinkToCreate?: (value: string) => void;
	handleClose: () => void;
	setAction: (value: string) => void;
}

interface NodeContextProps {
	node: Node;
	actions: NodeActions;
	setUnresolvedChanges: Dispatch<SetStateAction<boolean>>;
}

const NodeContext: React.FC<NodeContextProps> = ({
	node,
	actions,
	setUnresolvedChanges,
}) => {
	const { assuranceCase, setAssuranceCase } = useStore();
	const { data: session } = useSession();
	const [contexts, setContexts] = useState<Context[]>([]);
	const [loading, setLoading] = useState<boolean>(false);

	// Helper function to find the current goal in the assurance case
	const getCurrentGoal = useCallback(() => {
		if (!assuranceCase?.goals || node.type !== "goal") {
			return null;
		}
		return assuranceCase.goals.find((goal) => goal.id === node.data.id);
	}, [assuranceCase?.goals, node.type, node.data.id]);

	// console.log('NODE', node)
	// console.log('Case', assuranceCase.goals[0])

	const { setSelectedLink, setAction } = actions;

	const reset = () => {
		setSelectedLink(false);
		setAction("");
	};

	const handleCancel = () => {
		form.reset(); // Reset the form state
		reset(); // Perform additional reset actions
	};

	/** Function used to handle creation of a context node linked to a goal */
	const handleContextAdd = async (description: string) => {
		// Create a new context object to add - this should be created by calling the api
		const newContextItem = {
			short_description: description,
			long_description: description,
			goal_id: node.data.id,
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

		// Create a new context array by adding the new context item
		const currentGoal = getCurrentGoal();
		if (currentGoal && assuranceCase) {
			const newContext = [...(currentGoal.context || []), result.data].filter(
				Boolean
			);

			// Create a new assuranceCase object with the updated context array
			const updatedGoals = assuranceCase.goals?.map((goal) =>
				goal.id === node.data.id
					? ({ ...goal, context: newContext } as Goal)
					: goal
			);

			const updatedAssuranceCase = {
				...assuranceCase,
				goals: updatedGoals,
			};

			// Update Assurance Case in state
			setAssuranceCase(updatedAssuranceCase as AssuranceCase);
		}
		form.reset();
		setUnresolvedChanges(false);
	};

	/** Function used to handle deletion of a context node linked to a goal */
	const handleContextDelete = async (id: number) => {
		setLoading(true);
		const deleted = await deleteAssuranceCaseNode(
			"Context",
			id,
			session?.key ?? ""
		);

		if (deleted === true && assuranceCase) {
			const updatedAssuranceCase = await removeAssuranceCaseNode(
				assuranceCase,
				id,
				"Context"
			);
			if (updatedAssuranceCase) {
				// Update the assuranceCase which will trigger the useEffect to update contexts
				setAssuranceCase(updatedAssuranceCase);
				// Also update local state immediately for responsive UI
				const updatedGoal = updatedAssuranceCase.goals?.find(
					(goal) => goal.id === node.data.id
				);
				if (updatedGoal?.context) {
					setContexts(updatedGoal.context);
				} else {
					setContexts((prevContexts) =>
						prevContexts.filter((context) => context.id !== id)
					);
				}
				setLoading(false);
				toast({
					title: "Context deleted",
					description: "The context has been successfully removed.",
				});
				return;
			}
		}

		// If deletion failed, show error message
		setLoading(false);
		toast({
			title: "Error",
			description:
				typeof deleted === "object" && deleted.error
					? deleted.error
					: "Failed to delete the context. Please try again.",
			variant: "destructive",
		});
	};

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			description: "",
		},
	});

	async function onSubmit(values: z.infer<typeof formSchema>) {
		const description = values.description || "";
		if (description.trim()) {
			await handleContextAdd(description);
		}
	}

	useEffect(() => {
		// Update contexts from assuranceCase when it changes
		const currentGoal = getCurrentGoal();
		if (currentGoal?.context) {
			setContexts(currentGoal.context);
		} else if (!loading) {
			// Fallback to fetching if not available in assuranceCase and not currently loading
			const fetchNodeContext = async () => {
				const sessionKey = session?.key;
				if (!sessionKey) {
					return;
				}

				const result = await getAssuranceCaseNode(
					node.type ?? "",
					node.data.id,
					sessionKey
				);

				if (result && typeof result === "object" && "context" in result) {
					setContexts(
						(result as unknown as { context: Context[] }).context || []
					);
				}
			};

			fetchNodeContext();
		}
	}, [node.data.id, node.type, session?.key, getCurrentGoal, loading]);

	useEffect(() => {
		const subscription = form.watch((_values, { name }) => {
			if (name === "description") {
				setUnresolvedChanges(true);
			}
		});
		return () => subscription.unsubscribe();
	}, [form, setUnresolvedChanges]);

	return (
		<div className="my-4 border-t">
			<div className="mt-4 font-medium text-muted-foreground text-sm">
				Please add a new context using the form below.
			</div>

			<Form {...form}>
				<form className="my-4 space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
					<FormField
						control={form.control}
						name="description"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Description</FormLabel>
								<FormControl>
									<Textarea
										placeholder="Type your description here."
										rows={10}
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<div className="flex items-center justify-start gap-3 pt-4">
						<Button onClick={handleCancel} variant={"outline"}>
							Cancel
						</Button>
						<Button
							className="bg-indigo-500 hover:bg-indigo-600 dark:text-white"
							disabled={loading}
							type="submit"
						>
							Add Context
						</Button>
					</div>
				</form>
			</Form>

			<div className="mt-8 font-medium">Existing Contexts</div>
			<p className="mb-4 text-muted-foreground text-sm">
				Please manage your contexts below
			</p>

			{loading ? (
				<div className="flex w-full flex-col justify-start gap-2 py-8">
					<Skeleton className="h-[10px] w-full rounded-full" />
					<Skeleton className="h-[10px] w-2/3 rounded-full" />
					<div className="flex items-center justify-start gap-2">
						<Skeleton className="h-[10px] w-[20px] rounded-full" />
						<Skeleton className="h-[10px] w-[100px] rounded-full" />
					</div>
				</div>
			) : (
				<div className="mb-16 flex w-full flex-col items-start justify-start gap-3">
					{contexts.map((item: Context) => (
						<div
							className="group relative w-full rounded-md p-3 text-foreground transition-all duration-300 hover:cursor-pointer hover:bg-indigo-500 hover:pb-6 hover:text-white"
							key={item.id}
						>
							<p className="w-full whitespace-normal">
								{item.long_description}
							</p>
							<div className="mt-3 flex items-center justify-start gap-2 text-muted-foreground text-xs transition-all duration-300 group-hover:text-white">
								<div className="flex-1">
									{moment(item.created_date).format("DD/MM/YYYY")}
									<svg
										aria-hidden="true"
										className="mx-2 inline h-0.5 w-0.5 fill-current"
										viewBox="0 0 2 2"
									>
										<circle cx={1} cy={1} r={1} />
									</svg>
									{item.name}
								</div>
								<Button
									className="hidden items-center justify-center hover:bg-white/90 group-hover:flex [&:hover>svg]:text-red-600"
									onClick={() => handleContextDelete(item.id)}
									size={"sm"}
									variant={"ghost"}
								>
									<Trash2 className="h-4 w-4 text-white" />
								</Button>
							</div>
						</div>
					))}
					{contexts.length === 0 && (
						<div>
							<p className="flex items-center justify-start gap-2 text-muted-foreground text-sm">
								<FolderXIcon className="size-3" />
								No Contexts Added
							</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default NodeContext;

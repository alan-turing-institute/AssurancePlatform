"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { createAssuranceCase } from "@/actions/assurance-cases";
import {
	createCaseFromPattern,
	fetchViewablePatterns,
} from "@/actions/case-from-pattern";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useCreateCaseModal } from "@/hooks/modal-hooks";
import type { ActionResult } from "@/lib/errors";
import {
	type CreateAssuranceCaseInput,
	createAssuranceCaseSchema,
} from "@/lib/schemas/assurance-case";
import type { ViewablePattern } from "@/lib/services/case-from-pattern-service";
import { Button } from "../ui/button";
import {
	type PatternChoices,
	type StartFrom,
	StartFromSection,
} from "./_case-create-modal/start-from-section";

/**
 * Creates the case the dialog describes: a copy of the chosen pattern, a blank
 * pattern, or a blank case. Only a copy of a pattern can come back with
 * warnings.
 */
async function requestCase(
	start: StartFrom,
	chosen: ViewablePattern | undefined,
	name: string,
	description: string
): Promise<ActionResult<{ id: string; warnings: string[] }>> {
	if (start === "pattern" && chosen) {
		return await createCaseFromPattern(chosen.source, name, description);
	}
	const created = await createAssuranceCase({
		name,
		description,
		kind: start === "blank-pattern" ? "PATTERN" : "CASE",
	});
	return created.success
		? { success: true, data: { id: created.data.id, warnings: [] } }
		: created;
}

export const CaseCreateModal = () => {
	const createCaseModal = useCreateCaseModal();
	const router = useRouter();
	const { data: session } = useSession();

	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState<string[]>([]);
	const [start, setStart] = useState<StartFrom>("blank-case");
	const [choices, setChoices] = useState<PatternChoices>({ status: "idle" });
	const [patternKey, setPatternKey] = useState<string>();
	// A case started from a pattern that had to leave references out stops
	// here, so the user sees what was left out before opening the case.
	const [pending, setPending] = useState<{
		id: string;
		warnings: string[];
	} | null>(null);

	const form = useForm<CreateAssuranceCaseInput>({
		resolver: zodResolver(createAssuranceCaseSchema),
		defaultValues: {
			name: "",
			description: "",
		},
	});

	const loadPatterns = useCallback(async () => {
		setChoices({ status: "loading" });
		const patterns = await fetchViewablePatterns();
		setChoices(patterns ? { status: "ready", patterns } : { status: "failed" });
	}, []);

	const handleStartChange = (next: StartFrom) => {
		setStart(next);
		setErrors([]);
		if (next === "pattern" && choices.status !== "ready") {
			loadPatterns();
		}
	};

	const resetChoices = () => {
		setStart("blank-case");
		setChoices({ status: "idle" });
		setPatternKey(undefined);
		setPending(null);
		setErrors([]);
	};

	const handleClose = () => {
		resetChoices();
		createCaseModal.onClose();
	};

	const openCase = (id: string) => {
		resetChoices();
		createCaseModal.onClose();
		router.push(`/case/${id}`);
	};

	const CreateCase = async (name: string, description: string) => {
		// Check user.id for JWT-only mode compatibility (key may not exist in JWT-only mode)
		if (!session?.user?.id) {
			setErrors(["You must be logged in to create a case"]);
			return;
		}

		const chosen =
			choices.status === "ready"
				? choices.patterns.find((pattern) => pattern.key === patternKey)
				: undefined;
		if (start === "pattern" && !chosen) {
			setErrors(["Choose a pattern to start from"]);
			return;
		}

		setLoading(true);

		try {
			const result = await requestCase(start, chosen, name, description);

			setLoading(false);
			if (!result.success) {
				setErrors([
					result.error ?? "An error occurred, please try again later",
				]);
			} else if (result.data.warnings.length > 0) {
				setPending(result.data);
			} else {
				openCase(result.data.id);
			}
		} catch (_ex) {
			setLoading(false);
			setErrors(["An error occurred, please try again later"]);
		}
	};

	const handleCancel = (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		form.clearErrors();
		handleClose();
	};

	const onSubmit = (values: CreateAssuranceCaseInput) => {
		CreateCase(values.name, values.description);
	};

	const makingPattern = start === "blank-pattern";

	return (
		<Modal
			description="Choose how to start, then enter a name and description."
			isOpen={createCaseModal.isOpen}
			onClose={handleClose}
			title="Create New Assurance Case"
		>
			{loading && (
				<div className="flex items-center justify-center p-16">
					<Loader className="h-10 w-10 animate-spin" />
				</div>
			)}
			{!loading && pending && (
				<div className="space-y-4 py-2 pb-4">
					<div className="rounded-md border border-warning/30 bg-warning/10 p-2 text-sm text-warning-foreground">
						<p className="font-semibold">Some references were left out:</p>
						<ul className="list-inside list-disc">
							{pending.warnings.map((warning) => (
								<li key={warning}>{warning}</li>
							))}
						</ul>
					</div>
					<div className="flex w-full justify-end">
						<Button onClick={() => openCase(pending.id)}>
							Continue to case
						</Button>
					</div>
				</div>
			)}
			{!(loading || pending) && (
				<div className="space-y-4 py-2 pb-4">
					<div className="space-y-2">
						<Form {...form}>
							<form
								className="space-y-6"
								onSubmit={form.handleSubmit(onSubmit)}
							>
								<StartFromSection
									choices={choices}
									disabled={loading}
									onPatternChange={setPatternKey}
									onStartChange={handleStartChange}
									patternKey={patternKey}
									start={start}
								/>
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Name</FormLabel>
											<FormControl>
												<Input
													disabled={loading}
													placeholder={
														makingPattern ? "Pattern name" : "Case name"
													}
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="description"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Description</FormLabel>
											<FormControl>
												<Textarea
													disabled={loading}
													placeholder={
														makingPattern
															? "Your pattern description"
															: "Your case description"
													}
													rows={4}
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								{errors.length > 0 && (
									<div className="text-destructive text-sm">
										{errors.map((e) => (
											<p key={e}>{e}</p>
										))}
									</div>
								)}
								<div className="flex w-full items-center justify-end space-x-2 pt-6">
									<Button
										disabled={loading}
										onClick={(e) => handleCancel(e)}
										variant="outline"
									>
										Cancel
									</Button>
									<Button disabled={loading} type="submit">
										Submit
									</Button>
								</div>
							</form>
						</Form>
					</div>
				</div>
			)}
		</Modal>
	);
};

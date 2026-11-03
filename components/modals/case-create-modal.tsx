"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader } from "lucide-react";
import { useForm } from "react-hook-form";
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
import {
	type CreateAssuranceCaseInput,
	createAssuranceCaseSchema,
} from "@/lib/schemas/assurance-case";
import { Button } from "../ui/button";
import { LeftOutNotice } from "./_case-create-modal/left-out-notice";
import { StartFromSection } from "./_case-create-modal/start-from-section";
import { useCaseCreate } from "./_case-create-modal/use-case-create";
import { VariablesSection } from "./_case-create-modal/variables-section";

const PLACEHOLDERS = {
	case: { name: "Case name", description: "Your case description" },
	pattern: { name: "Pattern name", description: "Your pattern description" },
};

export const CaseCreateModal = () => {
	const createCaseModal = useCreateCaseModal();
	const {
		changeStart,
		choices,
		close,
		create,
		errors,
		loading,
		openCase,
		patternError,
		patternKey,
		pending,
		selectPattern,
		start,
		variables,
	} = useCaseCreate({
		onClose: createCaseModal.onClose,
		preset: createCaseModal.preset,
	});

	const form = useForm<CreateAssuranceCaseInput>({
		resolver: zodResolver(createAssuranceCaseSchema),
		defaultValues: {
			name: "",
			description: "",
		},
	});

	const handleCancel = (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		form.clearErrors();
		close();
	};

	const onSubmit = (values: CreateAssuranceCaseInput) => {
		create(values.name, values.description);
	};

	const placeholders =
		PLACEHOLDERS[start === "blank-pattern" ? "pattern" : "case"];

	return (
		<Modal
			description={
				pending
					? "Your case has been created from the pattern."
					: "Choose how to start, then enter a name and description."
			}
			isOpen={createCaseModal.isOpen}
			onClose={close}
			title="Create New Assurance Case"
		>
			{loading && (
				<div className="flex items-center justify-center p-16">
					<Loader className="h-10 w-10 animate-spin" />
				</div>
			)}
			{!loading && pending && (
				<LeftOutNotice
					onContinue={() => openCase(pending.id)}
					warnings={pending.warnings}
				/>
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
									onPatternChange={selectPattern}
									onStartChange={changeStart}
									patternError={patternError}
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
													placeholder={placeholders.name}
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
													placeholder={placeholders.description}
													rows={4}
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<VariablesSection
									disabled={loading}
									onChange={variables.change}
									onRetry={variables.retry}
									state={variables.state}
									typed={variables.typed}
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
										type="button"
										variant="outline"
									>
										Cancel
									</Button>
									<Button
										disabled={loading || variables.state.status === "loading"}
										type="submit"
									>
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

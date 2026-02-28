import { zodResolver } from "@hookform/resolvers/zod";
import type React from "react";
import { useForm } from "react-hook-form";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { type NoteFormInput, noteFormSchema } from "@/lib/schemas/comment";
import { toast } from "@/lib/toast";
import useStore from "@/store/store";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

const NotesForm: React.FC = () => {
	const { assuranceCase, caseNotes, setCaseNotes } = useStore();
	const form = useForm<NoteFormInput>({
		resolver: zodResolver(noteFormSchema),
		defaultValues: {
			note: "",
		},
	});

	async function onSubmit(values: NoteFormInput) {
		if (!assuranceCase) {
			toast({
				variant: "destructive",
				title: "Error",
				description: "No assurance case found",
			});
			return;
		}

		try {
			// Use Next.js API route which handles both Prisma and Django auth
			const response = await fetch(`/api/cases/${assuranceCase.id}/comments`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					content: values.note,
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to create note");
			}

			const result = await response.json();

			const newCaseNotes = [...caseNotes, result];
			setCaseNotes(newCaseNotes);

			form.setValue("note", "");
		} catch (_error) {
			toast({
				variant: "destructive",
				title: "Failed to create note",
				description: "Something went wrong trying to add the note.",
			});
		}
	}

	return (
		<Form {...form}>
			<form className="mt-6 space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
				<FormField
					control={form.control}
					name="note"
					render={({ field }) => (
						<FormItem>
							<FormLabel>New Note</FormLabel>
							<FormControl>
								<Textarea placeholder="Type your note here." {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<div className="flex items-center justify-start gap-3">
					<Button
						className="bg-primary text-primary-foreground hover:bg-primary/90"
						type="submit"
					>
						Add Note
					</Button>
				</div>
			</form>
		</Form>
	);
};

export default NotesForm;

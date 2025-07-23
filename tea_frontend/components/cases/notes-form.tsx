import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import type React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import useStore from "@/data/store";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { useToast } from "../ui/use-toast";

// import { useLoginToken } from '.*/use-auth'

const formSchema = z.object({
	note: z.string().min(2, {
		message: "Note must be atleast 2 characters",
	}),
});

const NotesForm: React.FC = () => {
	const { assuranceCase, caseNotes, setCaseNotes } = useStore();
	// const [token] = useLoginToken();
	const { data: session } = useSession();
	const { toast } = useToast();

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			note: "",
		},
	});

	async function onSubmit(values: z.infer<typeof formSchema>) {
		if (!assuranceCase) {
			toast({
				variant: "destructive",
				title: "Error",
				description: "No assurance case found",
			});
			return;
		}

		try {
			const url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${assuranceCase.id}/comments/`;

			const requestOptions: RequestInit = {
				method: "POST",
				headers: {
					Authorization: `Token ${session?.key}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					content: values.note,
					assurance_case: assuranceCase.id,
				}),
			};
			const response = await fetch(url, requestOptions);

			if (!response.ok) {
				// Handle error - response not ok
				throw new Error("Failed to create note");
			}

			const result = await response.json();

			const newCaseNotes = [...caseNotes, result];
			setCaseNotes(newCaseNotes);

			// const updatedComments = [ ...assuranceCase.comments, result ]
			// const updatedAssuranceCase = {
			//   ...assuranceCase,
			//   comments: updatedComments
			// }

			// setAssuranceCase(updatedAssuranceCase)

			form.setValue("note", "");
		} catch (_error) {
			// Handle error - show toast notification
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
						className="bg-indigo-500 text-white hover:bg-indigo-600"
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

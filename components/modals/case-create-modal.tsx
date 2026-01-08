"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createAssuranceCase } from "@/actions/assurance-cases";
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
import { useCreateCaseModal } from "@/hooks/use-create-case-modal";
import { Button } from "../ui/button";

const formSchema = z.object({
	name: z.string().min(1),
	description: z.string().min(1),
	// template: z.string().min(1)
});

export const CaseCreateModal = () => {
	const createCaseModal = useCreateCaseModal();
	const router = useRouter();
	// const [token] = useLoginToken();
	const { data: session } = useSession();

	const [loading, setLoading] = useState(false);
	const [_stage, _setStage] = useState(0);
	// const [templates, setTemplates] = useState<any[]>([]);
	// const [defaultValue, setDefaultValue] = useState(0);
	const [_errors, setErrors] = useState<string[]>([]);

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			description: "",
			// template: ""
		},
	});

	const CreateCase = useCallback(
		async (name: string, description: string) => {
			// Check user.id for JWT-only mode compatibility (key may not exist in JWT-only mode)
			if (!session?.user?.id) {
				setErrors(["You must be logged in to create a case"]);
				return;
			}

			setLoading(true);

			try {
				// Pass empty string - server action uses validateSession() internally
				const result = await createAssuranceCase("", {
					name,
					description,
				});

				if (result.success) {
					setLoading(false);
					createCaseModal.onClose();
					router.push(`/case/${result.data.id}`);
				} else {
					setLoading(false);
					setErrors([
						result.error ?? "An error occurred, please try again later",
					]);
				}
			} catch (_ex) {
				setLoading(false);
				setErrors(["An error occurred, please try again later"]);
			}
		},
		[session, createCaseModal, router]
	);

	const handleCancel = (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		form.clearErrors();
		createCaseModal.onClose();
	};

	const onSubmit = (values: z.infer<typeof formSchema>) => {
		CreateCase(values.name, values.description);
	};

	// const fetchTemplates = async () => {
	//   const response = await fetch('/api/templates')
	//   const result = await response.json()
	//   return result
	// }

	// useEffect(() => {
	//   fetchTemplates().then(result => {
	//     setTemplates(result.newTemplates);
	//     setDefaultValue(result.defaultCase);
	//   })
	// },[])

	return (
		<Modal
			description="Please enter a name and description for your new assurance case."
			isOpen={createCaseModal.isOpen}
			onClose={createCaseModal.onClose}
			title="Create New Assurance Case"
		>
			{loading ? (
				<div className="flex items-center justify-center p-16">
					<Loader className="h-10 w-10 animate-spin" />
				</div>
			) : (
				<div className="space-y-4 py-2 pb-4">
					<div className="space-y-2">
						<Form {...form}>
							<form
								className="space-y-6"
								onSubmit={form.handleSubmit(onSubmit)}
							>
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Name</FormLabel>
											<FormControl>
												<Input
													disabled={loading}
													placeholder="Case name"
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
													placeholder="Your case description"
													rows={6}
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								{/* <FormField
                control={form.control}
                name="template"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Select a template...</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        {templates.map((template, index) => (
                          <FormItem key={crypto.randomUUID()} className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value={index.toString()} />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {template.name}
                            </FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              /> */}
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

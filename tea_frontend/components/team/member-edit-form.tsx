import { zodResolver } from "@hookform/resolvers/zod";
import type React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

type TeamMember = {
	id: number;
	name: string;
	title: string;
	department: string;
	email: string;
	role: string;
	isAdmin: boolean;
	image: string;
};

import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "../ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { Separator } from "../ui/separator";
import { Switch } from "../ui/switch";

const formSchema = z.object({
	name: z.string().min(2, {
		message: "Name must be at least 2 characters.",
	}),
	title: z.string().min(2, {
		message: "Job Title must be atleast 2 characters",
	}),
	department: z.string({ required_error: "Please select a team" }),
	isAdmin: z.boolean().default(false).optional(),
});

type MemberEditFormProps = {
	member: TeamMember;
};

const MemberEditForm: React.FC<MemberEditFormProps> = ({ member }) => {
	const departments = [
		"Technology",
		"HR",
		"Corporate",
		"Optimization",
		"Projects",
	];

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: member,
	});

	function onSubmit(_values: z.infer<typeof formSchema>) {
		// TODO: Implement form submission logic
	}

	return (
		<Form {...form}>
			<form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Name</FormLabel>
							<FormControl>
								<Input placeholder="Member name" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="title"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Job Title</FormLabel>
							<FormControl>
								<Input {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="department"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Department</FormLabel>
							<Select defaultValue={field.value} onValueChange={field.onChange}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select a team" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{departments.map((department) => (
										<SelectItem key={crypto.randomUUID()} value={department}>
											{department}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="isAdmin"
					render={({ field }) => (
						<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
							<div className="space-y-0.5">
								<FormLabel className="text-base">Admin</FormLabel>
								<FormDescription>
									The admin has full control over the application.
								</FormDescription>
							</div>
							<FormControl>
								<Switch
									checked={field.value}
									onCheckedChange={field.onChange}
								/>
							</FormControl>
						</FormItem>
					)}
				/>
				<Separator />
				<div className="flex items-center justify-start gap-3">
					<Button type="submit">Update Member</Button>
					<Button variant={"outline"}>Deactivate</Button>
				</div>
			</form>
		</Form>
	);
};

export default MemberEditForm;

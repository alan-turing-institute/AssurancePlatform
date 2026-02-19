"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { type FileFormInput, fileFormSchema } from "./use-case-import";

export type FileImportTabProps = {
	importCase: (json: unknown) => Promise<void>;
	loading: boolean;
	setError: (error: string) => void;
	className?: string;
};

/**
 * File upload tab content for the import modal.
 * Reads a local JSON file and passes the parsed content to importCase.
 */
export function FileImportTab({
	importCase,
	loading,
	setError,
	className,
}: FileImportTabProps) {
	const form = useForm<FileFormInput>({
		resolver: zodResolver(fileFormSchema),
	});

	const onSubmit = (values: FileFormInput) => {
		const { file } = values;

		try {
			if (file) {
				const fileReader = new FileReader();

				fileReader.onload = async (event: ProgressEvent<FileReader>) => {
					try {
						const json = JSON.parse(event.target?.result as string);
						await importCase(json);
					} catch {
						setError("Error parsing JSON file, bad format.");
					}
				};

				fileReader.readAsText(file as File);
			}
		} catch {
			setError("Error reading file");
		}
	};

	return (
		<Form {...form}>
			<form
				className={cn("w-full space-y-6", className)}
				onSubmit={form.handleSubmit(onSubmit)}
			>
				<FormField
					control={form.control}
					name="file"
					render={({ field: { onChange, value: _value, ...fieldProps } }) => (
						<FormItem>
							<FormLabel>JSON File</FormLabel>
							<FormControl>
								<Input
									{...fieldProps}
									accept=".json,application/json"
									disabled={loading}
									onChange={(event) => onChange(event.target.files?.[0])}
									type="file"
								/>
							</FormControl>
							<FormDescription>
								Upload a JSON file exported from this platform or compatible
								tools.
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button disabled={loading} type="submit">
					{loading ? "Importing..." : "Import File"}
				</Button>
			</form>
		</Form>
	);
}

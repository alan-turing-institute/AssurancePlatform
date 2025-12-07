"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useImportModal } from "@/hooks/use-import-modal";

const ACCEPTED_FILE_TYPES = ["application/json"];

const formSchema = z.object({
	file: z.any().refine((files) => {
		if (!files) {
			return "Please select a file.";
		}
		if (!(files instanceof FileList)) {
			return "Expected a file.";
		}
		const filesArray = Array.from(files);
		if (!filesArray.every((file) => ACCEPTED_FILE_TYPES.includes(file.type))) {
			return "Only JSON files are allowed.";
		}
		return true;
	}),
});

type ImportResponse = {
	id?: string | number;
	name?: string;
	elementCount?: number;
	warnings?: string[];
	error?: string;
	validationErrors?: string[];
};

export const ImportModal = () => {
	const importModal = useImportModal();

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string>("");
	const [warnings, setWarnings] = useState<string[]>([]);

	const router = useRouter();

	const form = useForm({
		resolver: zodResolver(formSchema),
	});

	/**
	 * Import using Prisma-based API (v1 and v2 format support).
	 */
	const importCase = useCallback(
		async (json: unknown) => {
			setLoading(true);
			setError("");
			setWarnings([]);

			try {
				const response = await fetch("/api/cases/import", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(json),
				});

				const data: ImportResponse = await response.json();

				if (!response.ok) {
					if (data.validationErrors && data.validationErrors.length > 0) {
						setError(`Validation failed: ${data.validationErrors.join(", ")}`);
					} else {
						setError(data.error ?? "Failed to import case");
					}
					setLoading(false);
					return;
				}

				if (data.warnings && data.warnings.length > 0) {
					setWarnings(data.warnings);
				}

				if (data.id) {
					importModal.onClose();
					router.push(`/case/${data.id}`);
				}
			} catch {
				setError("An error occurred, please try again later");
			} finally {
				setLoading(false);
			}
		},
		[importModal, router]
	);

	const onSubmit = (values: z.infer<typeof formSchema>) => {
		const { file } = values;

		try {
			if (file) {
				const fileReader = new FileReader();

				fileReader.onload = async (event: ProgressEvent<FileReader>) => {
					try {
						const json = JSON.parse(event.target?.result as string);
						await importCase(json);
					} catch (_error) {
						setError("Error parsing JSON file, bad format.");
					}
				};

				fileReader.readAsText(file);
			}
		} catch (_error) {
			setError("Error reading file");
		}
	};

	const handleModalClose = () => {
		setError("");
		setWarnings([]);
		importModal.onClose();
	};

	return (
		<Modal
			description="Please select a file you wish to import to create your case."
			isOpen={importModal.isOpen}
			onClose={handleModalClose}
			title="Import File"
		>
			{error && (
				<div className="pb-2 font-semibold text-rose-500 text-sm">{error}</div>
			)}
			{warnings.length > 0 && (
				<div className="mb-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-800 text-sm">
					<p className="font-semibold">Import warnings:</p>
					<ul className="list-inside list-disc">
						{warnings.map((w) => (
							<li key={w}>{w}</li>
						))}
					</ul>
				</div>
			)}
			<Form {...form}>
				<form
					className="w-full space-y-6"
					onSubmit={form.handleSubmit(onSubmit)}
				>
					<FormField
						control={form.control}
						name="file"
						render={({ field: { onChange, value: _value, ...fieldProps } }) => (
							<FormItem>
								<FormControl>
									<Input
										{...fieldProps}
										disabled={loading}
										onChange={(event) => onChange(event.target.files?.[0])}
										type="file"
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<Button disabled={loading} type="submit">
						{loading ? "Importing..." : "Submit"}
					</Button>
				</form>
			</Form>
		</Modal>
	);
};

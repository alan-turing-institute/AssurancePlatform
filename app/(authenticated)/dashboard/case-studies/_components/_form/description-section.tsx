"use client";

import { InfoIcon } from "lucide-react";
import type { useForm } from "react-hook-form";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import TiptapEditor from "@/components/ui/tiptap-editor";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CaseStudyFormValues } from "./form-schema";

export interface DescriptionSectionProps {
	className?: string;
	form: ReturnType<typeof useForm<CaseStudyFormValues>>;
	setValue: React.Dispatch<React.SetStateAction<string>>;
	value: string;
}

export function DescriptionSection({
	form,
	value,
	setValue,
	className,
}: DescriptionSectionProps) {
	return (
		<div className={cn("space-y-6", className)}>
			<div>
				<h3 className="font-medium text-lg">Case Study Description</h3>
				<p className="text-muted-foreground text-sm">
					Provide a detailed description of your case study
				</p>
			</div>

			<FormField
				control={form.control}
				name="description"
				render={({ field }) => (
					<FormItem>
						<div className="mb-2 flex items-center gap-1">
							<FormLabel>Description</FormLabel>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<span>
											<InfoIcon className="h-4 w-4 cursor-pointer text-muted-foreground" />
										</span>
									</TooltipTrigger>
									<TooltipContent side="right">
										Provide a clear and concise summary of the case study.
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
						<FormControl>
							<ErrorBoundary
								fallback={
									<div className="flex min-h-[200px] items-center justify-center rounded-md border text-muted-foreground">
										<p>Editor failed to load. Please refresh.</p>
									</div>
								}
							>
								<TiptapEditor
									className="min-h-[200px]"
									onChange={(content) => {
										field.onChange(content);
										setValue(content);
									}}
									placeholder="Provide a clear and concise summary of the case study..."
									value={field.value || value}
								/>
							</ErrorBoundary>
						</FormControl>
						<FormMessage />
					</FormItem>
				)}
			/>
		</div>
	);
}

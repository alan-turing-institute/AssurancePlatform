"use client";

import { X } from "lucide-react";
import type { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CaseStudyFormValues } from "./form-schema";

export type AuthorSectionProps = {
	form: ReturnType<typeof useForm<CaseStudyFormValues>>;
	authors: string[];
	inputValue: string;
	setInputValue: React.Dispatch<React.SetStateAction<string>>;
	addAuthor: () => void;
	removeAuthor: (authorToRemove: string) => void;
	isPublished: boolean;
	className?: string;
};

export function AuthorSection({
	form,
	authors,
	inputValue,
	setInputValue,
	addAuthor,
	removeAuthor,
	isPublished,
	className,
}: AuthorSectionProps) {
	return (
		<div className={cn("space-y-6", className)}>
			<div>
				<h3 className="font-medium text-lg">Author Information</h3>
				<p className="text-muted-foreground text-sm">
					Add all authors and specify contact details for correspondence
				</p>
			</div>

			<FormField
				control={form.control}
				name="authors"
				render={() => (
					<FormItem>
						<FormLabel>Authors</FormLabel>
						<FormDescription>
							List all authors who contributed to this case study
						</FormDescription>

						<div className="mb-2 flex items-center gap-2">
							<Input
								onChange={(e) => setInputValue(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										addAuthor();
									}
								}}
								placeholder="Enter author name"
								value={inputValue}
							/>
							<Button onClick={addAuthor} type="button" variant="secondary">
								Add Author
							</Button>
						</div>

						<div className="flex flex-wrap gap-2">
							{authors.map((author) => (
								<span
									className="flex items-center rounded-full bg-muted px-3 py-1.5 text-sm"
									key={author}
								>
									{author}
									{!isPublished && (
										<button
											className="ml-2 text-muted-foreground hover:text-destructive"
											onClick={() => removeAuthor(author)}
											type="button"
										>
											<X className="h-3 w-3" />
										</button>
									)}
								</span>
							))}
							{authors.length === 0 && (
								<span className="text-muted-foreground text-sm italic">
									No authors added yet
								</span>
							)}
						</div>

						<FormMessage />
					</FormItem>
				)}
			/>

			<FormField
				control={form.control}
				name="contact"
				render={({ field }) => (
					<FormItem>
						<FormLabel>Corresponding Author Email</FormLabel>
						<FormDescription>
							Email address of the author who will handle correspondence about
							this case study (should be one of the authors listed above)
						</FormDescription>
						<FormControl>
							<Input
								{...field}
								className="max-w-md"
								placeholder="author@example.com"
								type="email"
							/>
						</FormControl>
						<FormMessage />
					</FormItem>
				)}
			/>
		</div>
	);
}

"use client";

import { InfoIcon, X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

interface AuthorsTagInputProps {
	disabled?: boolean;
	onChange: (value: string) => void;
	placeholder?: string;
	value: string;
}

/**
 * Splits the stored comma-joined authors string into display chips. Kept
 * deliberately simple (no migration, ADR 0003 §1): a legacy single-author
 * value with no comma loads as one chip, and a value that already contains
 * commas — from the old free-text field, or from a previous save of this
 * component — splits unambiguously on the comma.
 */
function parseAuthors(value: string): string[] {
	return value
		.split(",")
		.map((name) => name.trim())
		.filter(Boolean);
}

function serialiseAuthors(authors: string[]): string {
	return authors.join(", ");
}

/**
 * Tag-style entry for the case-information "Authors" field (ADR 0003 §1).
 * Type a name, press Enter to add it as a removable chip; Backspace on an
 * empty draft removes the last chip. The underlying value stays a single
 * comma-joined string — the schema and database field are unchanged, so no
 * migration is needed (Chris's constraint, publish completion pane brief).
 */
export function AuthorsTagInput({
	value,
	onChange,
	disabled,
	placeholder = "e.g. Ada Lovelace",
}: AuthorsTagInputProps) {
	const [draft, setDraft] = useState("");
	const authors = parseAuthors(value);

	const addAuthor = () => {
		const name = draft.trim();
		if (!name) {
			return;
		}
		if (authors.includes(name)) {
			setDraft("");
			return;
		}
		onChange(serialiseAuthors([...authors, name]));
		setDraft("");
	};

	const removeAuthor = (name: string) => {
		onChange(serialiseAuthors(authors.filter((author) => author !== name)));
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			event.preventDefault();
			addAuthor();
		} else if (
			event.key === "Backspace" &&
			draft === "" &&
			authors.length > 0
		) {
			removeAuthor(authors.at(-1) as string);
		}
	};

	return (
		<div className="space-y-2">
			<div className="flex items-center gap-1.5">
				<Input
					aria-describedby="authors-tag-input-help"
					disabled={disabled}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={onKeyDown}
					placeholder={placeholder}
					value={draft}
				/>
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								aria-label="How author entry works"
								className="shrink-0 text-muted-foreground hover:text-foreground"
								type="button"
							>
								<InfoIcon className="h-4 w-4" />
							</button>
						</TooltipTrigger>
						<TooltipContent className="max-w-xs">
							Type a name and press Enter to add it as a tag. Click the × on a
							tag, or press Backspace with an empty input, to remove it.
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>
			<p className="text-muted-foreground text-xs" id="authors-tag-input-help">
				Press Enter to add an author as a tag.
			</p>
			{authors.length > 0 && (
				<div className="flex flex-wrap gap-1.5" data-testid="authors-tag-list">
					{authors.map((author) => (
						<Badge
							className="gap-1 py-1 pr-1 pl-2.5"
							key={author}
							variant="secondary"
						>
							{author}
							<button
								aria-label={`Remove ${author}`}
								className="rounded-full p-0.5 hover:bg-muted-foreground/20"
								disabled={disabled}
								onClick={() => removeAuthor(author)}
								type="button"
							>
								<X className="h-3 w-3" />
							</button>
						</Badge>
					))}
				</div>
			)}
		</div>
	);
}

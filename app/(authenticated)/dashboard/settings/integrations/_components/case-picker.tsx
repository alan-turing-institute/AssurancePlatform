"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface CasePickerOption {
	id: string;
	name: string;
}

export interface CasePickerProps {
	cases: readonly CasePickerOption[];
	onChange: (caseId: string) => void;
	value: string;
}

/**
 * A searchable case picker (shadcn's Combobox pattern). The list scrolls
 * inside the popover, which takes the trigger's width, and each case name
 * wraps rather than truncating so a long name stays readable on a phone.
 * Names are shown as text only. Items are matched on the case name; the id
 * only identifies the item, so two cases with the same name stay separate.
 */
export function CasePicker({ cases, onChange, value }: CasePickerProps) {
	const [open, setOpen] = useState(false);
	const selected = cases.find((c) => c.id === value);

	function choose(caseId: string) {
		onChange(caseId);
		setOpen(false);
	}

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild>
				<Button
					aria-expanded={open}
					aria-label="Case"
					className="h-8 w-full justify-between text-xs sm:w-56"
					role="combobox"
					type="button"
					variant="outline"
				>
					<span className="truncate" title={selected?.name}>
						{selected?.name ?? "Choose a case…"}
					</span>
					<ChevronsUpDown aria-hidden="true" className="opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				aria-label="Choose a case"
				className="w-(--radix-popover-trigger-width) p-0"
			>
				<Command
					filter={(_id, search, keywords) =>
						keywords?.[0]?.toLowerCase().includes(search.trim().toLowerCase())
							? 1
							: 0
					}
				>
					<CommandInput placeholder="Search cases" />
					<CommandList className="max-h-[min(300px,calc(var(--radix-popover-content-available-height)_-_3.5rem))]">
						<CommandEmpty>No case matches.</CommandEmpty>
						<CommandGroup>
							{cases.map((c) => (
								<CommandItem
									key={c.id}
									keywords={[c.name]}
									onSelect={() => choose(c.id)}
									value={c.id}
								>
									<Check
										aria-hidden="true"
										className={cn("opacity-0", c.id === value && "opacity-100")}
									/>
									<span className="min-w-0 break-words">{c.name}</span>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

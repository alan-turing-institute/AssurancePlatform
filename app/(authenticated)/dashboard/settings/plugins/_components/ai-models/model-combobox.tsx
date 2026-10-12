"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { isRecommendedModel, modelOptions } from "./ai-models-copy";

export interface ModelComboboxProps {
	disabled?: boolean;
	id: string;
	/** The id of the element that names this field, so a screen reader hears the model beside its label. */
	labelledBy: string;
	/** True while the connection's model list is being fetched. */
	loading: boolean;
	/** The models the connection listed for this job. */
	models: readonly string[];
	onChange: (model: string) => void;
	/** Called each time the list opens, so a screen can fetch the models then. */
	onOpen: () => void;
	/** The recommended model for this job on this connection type, or null. */
	recommended: string | null;
	value: string;
}

/**
 * A searchable model picker (shadcn's Combobox pattern). The list comes from
 * the connection's own model list and always offers the recommended model,
 * marked "Recommended". A name that is not in the list can be typed and used.
 * Names are shown as text only.
 */
export function ModelCombobox({
	disabled = false,
	id,
	labelledBy,
	loading,
	models,
	onChange,
	onOpen,
	recommended,
	value,
}: ModelComboboxProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const options = useMemo(
		() => modelOptions(models, recommended),
		[models, recommended]
	);
	const typed = search.trim();
	const offerTyped = typed.length > 0 && !options.includes(typed);

	function handleOpenChange(next: boolean) {
		setOpen(next);
		if (next) {
			setSearch("");
			onOpen();
		}
	}

	function choose(model: string) {
		onChange(model);
		setOpen(false);
	}

	return (
		<Popover onOpenChange={handleOpenChange} open={open}>
			<PopoverTrigger asChild>
				<Button
					aria-expanded={open}
					aria-labelledby={`${labelledBy} ${id}`}
					className="w-full justify-between"
					disabled={disabled}
					id={id}
					role="combobox"
					variant="outline"
				>
					<span className="truncate">{value || "Choose a model"}</span>
					{value && isRecommendedModel(value, recommended) && (
						<Badge variant="secondary">Recommended</Badge>
					)}
					<ChevronsUpDown className="opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-(--radix-popover-trigger-width) p-0"
			>
				<Command>
					<CommandInput
						onValueChange={setSearch}
						placeholder="Search, or type a model name"
						value={search}
					/>
					<CommandList>
						<CommandEmpty>
							{loading ? "Loading models…" : "No listed model matches."}
						</CommandEmpty>
						<CommandGroup>
							{options.map((name) => (
								<CommandItem
									key={name}
									onSelect={() => choose(name)}
									value={name}
								>
									<Check
										className={cn("opacity-0", name === value && "opacity-100")}
									/>
									{name}
									{isRecommendedModel(name, recommended) && (
										<Badge className="ml-auto" variant="secondary">
											Recommended
										</Badge>
									)}
								</CommandItem>
							))}
						</CommandGroup>
						{offerTyped && (
							<CommandItem
								forceMount
								onSelect={() => choose(typed)}
								value={`use ${typed}`}
							>
								{`Use "${typed}"`}
							</CommandItem>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { Node } from "reactflow";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import ActionTooltip from "../ui/action-tooltip";
import { Button } from "../ui/button";

type SearchNodesProps = {
	nodes: Node[];
	focusNode: (value: string) => void;
};
const SearchNodes = ({ nodes, focusNode }: SearchNodesProps) => {
	const [value, setValue] = useState("");
	const [searchOpen, setSearchOpen] = useState(false);
	const [filteredNodes, setFilteredNodes] = useState(nodes);

	const handleSearch = (searchValue: string) => {
		setValue(searchValue);

		if (searchValue !== "") {
			const result = nodes.filter((node) =>
				node.data.short_description.toLowerCase().includes(value.toLowerCase())
			);
			setFilteredNodes(result);
		}
	};

	const handleSearchClose = () => {
		setValue("");
		setSearchOpen(false);
		setFilteredNodes(nodes);
	};

	const handleSelection = (nodeId: string) => {
		focusNode(nodeId);
		setSearchOpen(false);
	};

	useEffect(() => {
		setFilteredNodes(nodes);
	}, [nodes]);

	return (
		<>
			<ActionTooltip label="Search">
				<Button
					onClick={() => setSearchOpen(true)}
					size={"sm"}
					variant={"ghost"}
				>
					<Search className="h-4 w-4" />
					<span className="sr-only">Search</span>
				</Button>
			</ActionTooltip>
			<Dialog onOpenChange={handleSearchClose} open={searchOpen}>
				<DialogContent className="sm:max-w-md md:max-w-xl lg:max-w-2xl">
					<DialogHeader>
						<DialogTitle>Search Nodes</DialogTitle>
						<DialogDescription>
							Enter your keywords into the input below to find a node.
						</DialogDescription>
					</DialogHeader>
					<div className="flex items-center space-x-2">
						<div className="grid flex-1 gap-2">
							<Label className="sr-only" htmlFor="link">
								Link
							</Label>
							<Input
								autoComplete="off"
								defaultValue=""
								id="searchValue"
								onChange={(e) => handleSearch(e.target.value)}
								value={value}
							/>
						</div>
					</div>
					<div className="max-h-[320px] overflow-y-auto">
						{filteredNodes.map((node) => (
							<div key={node.id}>
								<button
									className="group my-2 flex w-full flex-col items-start justify-start gap-1 rounded-md p-2 text-left hover:bg-indigo-500 hover:text-white"
									onClick={() => handleSelection(node.id)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											handleSelection(node.id);
										}
									}}
									type="button"
								>
									<div className="flex flex-col items-start">
										<span className="mb-2 font-medium text-muted-foreground text-xs uppercase group-hover:text-white">
											Identifier: {node.data.name}
										</span>
										<span className="line-clamp-2 w-full text-sm">
											{node.data.short_description}
										</span>
									</div>
								</button>
								<Separator />
							</div>
						))}
					</div>
					{/* <DialogFooter className="sm:justify-start">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Close
              </Button>
            </DialogClose>
          </DialogFooter> */}
				</DialogContent>
			</Dialog>
		</>
	);
};

export default SearchNodes;

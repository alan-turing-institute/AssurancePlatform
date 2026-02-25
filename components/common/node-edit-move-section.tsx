"use client";

import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Goal, PropertyClaim, Strategy } from "@/types";
import type { AssuranceCaseNode, MoveElement } from "./node-edit-types";

export type MoveSectionProps = {
	node: AssuranceCaseNode;
	goal: Goal | undefined;
	strategies: Strategy[];
	claims: PropertyClaim[];
	setSelectedClaimMove: (element: MoveElement | null) => void;
	setSelectedEvidenceMove: (element: MoveElement | null) => void;
	handleMove: () => Promise<void>;
	setAction: Dispatch<SetStateAction<string | null>>;
	className?: string;
};

export const MoveSection = ({
	node,
	goal,
	strategies,
	claims,
	setSelectedClaimMove,
	setSelectedEvidenceMove,
	handleMove,
	setAction,
}: MoveSectionProps) => (
	<>
		{node.type === "property" || node.type === "evidence" ? (
			<div className="w-full pt-4">
				<h3 className="mt-6 mb-2 font-semibold text-lg capitalize">
					Move {node.type}
				</h3>
				<div className="items-left flex flex-col justify-start gap-2">
					{node.type === "property" && (
						<Select
							onValueChange={(value) => {
								const parsedValue = JSON.parse(value);
								setSelectedClaimMove(parsedValue);
							}}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select an option" />
							</SelectTrigger>
							<SelectContent>
								{goal && (
									<SelectItem
										key={goal.id}
										value={JSON.stringify({ id: goal.id, name: goal.name })}
									>
										<div className="flex flex-col items-start justify-start gap-1">
											<div className="flex items-center">
												<span className="font-medium">{goal.name}</span>
												<svg
													aria-hidden="true"
													className="mx-2 inline h-0.5 w-0.5 fill-current"
													viewBox="0 0 2 2"
												>
													<circle cx={1} cy={1} r={1} />
												</svg>
												<span className="max-w-[200px] truncate">
													{goal.short_description}
												</span>
											</div>
										</div>
									</SelectItem>
								)}
								{strategies?.map((strategy) => (
									<SelectItem
										key={strategy.id}
										value={JSON.stringify({
											id: strategy.id,
											name: strategy.name,
										})}
									>
										<div className="flex items-start justify-start gap-1">
											<div className="flex items-center">
												<span className="font-medium">{strategy.name}</span>
												<svg
													aria-hidden="true"
													className="mx-2 inline h-0.5 w-0.5 fill-current"
													viewBox="0 0 2 2"
												>
													<circle cx={1} cy={1} r={1} />
												</svg>
												<span className="max-w-[200px] truncate">
													{strategy.short_description}
												</span>
											</div>
										</div>
									</SelectItem>
								))}
								{claims?.map((claim) => (
									<SelectItem
										key={claim.id}
										value={JSON.stringify({ id: claim.id, name: claim.name })}
									>
										<div className="flex flex-col items-start justify-start gap-1">
											<div className="flex items-center">
												<span className="font-medium">{claim.name}</span>
												<svg
													aria-hidden="true"
													className="mx-2 inline h-0.5 w-0.5 fill-current"
													viewBox="0 0 2 2"
												>
													<circle cx={1} cy={1} r={1} />
												</svg>
												<span className="max-w-[200px] truncate">
													{claim.short_description}
												</span>
											</div>
										</div>
									</SelectItem>
								))}
								{strategies?.length === 0 && (
									<SelectItem disabled={true} value="{strategy.id}">
										No strategies found.
									</SelectItem>
								)}
							</SelectContent>
						</Select>
					)}
					{node.type === "evidence" && (
						<Select
							onValueChange={(value) => {
								const parsedValue = JSON.parse(value);
								setSelectedEvidenceMove(parsedValue);
							}}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select an option" />
							</SelectTrigger>
							<SelectContent>
								{claims?.map((claim) => (
									<SelectItem
										key={claim.id}
										value={JSON.stringify({ id: claim.id, name: claim.name })}
									>
										<div className="flex flex-col items-start justify-start gap-1">
											<div className="flex items-center">
												<span className="font-medium">{claim.name}</span>
												<svg
													aria-hidden="true"
													className="mx-2 inline h-0.5 w-0.5 fill-current"
													viewBox="0 0 2 2"
												>
													<circle cx={1} cy={1} r={1} />
												</svg>
												<span className="max-w-[200px] truncate">
													{claim.short_description}
												</span>
											</div>
										</div>
									</SelectItem>
								))}
								{claims && claims.length === 0 && (
									<SelectItem disabled={true} value="{strategy.id}">
										No property claims found.
									</SelectItem>
								)}
							</SelectContent>
						</Select>
					)}
				</div>
			</div>
		) : null}
		<div className="flex items-center justify-start gap-2">
			<Button
				className="bg-primary text-primary-foreground hover:bg-primary/90"
				onClick={handleMove}
			>
				Move
			</Button>
			<Button
				className="my-6"
				onClick={() => setAction(null)}
				variant={"outline"}
			>
				Cancel
			</Button>
		</div>
	</>
);

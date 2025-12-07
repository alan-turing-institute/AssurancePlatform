"use client";

import { EllipsisVerticalIcon, EyeIcon } from "lucide-react";
import Link from "next/link";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TableActionsProps } from "@/types/domain";
import DeleteCaseButton from "./delete-button";
import UnpublishCaseButton from "./unpublish-button";

const TableActions = ({ caseStudy }: TableActionsProps) => (
	<DropdownMenu>
		<DropdownMenuTrigger>
			<EllipsisVerticalIcon className="size-4" />
		</DropdownMenuTrigger>
		<DropdownMenuContent>
			<DropdownMenuLabel>Actions</DropdownMenuLabel>
			<DropdownMenuSeparator />
			<DropdownMenuItem>
				<Link
					className="flex items-center"
					href={`case-studies/${caseStudy.id}`}
				>
					<EyeIcon className="mr-2 size-4" />
					View
				</Link>
			</DropdownMenuItem>
			{caseStudy.published && (
				<DropdownMenuItem asChild>
					<UnpublishCaseButton caseStudyId={caseStudy.id} />
				</DropdownMenuItem>
			)}
			<DropdownMenuItem asChild>
				<DeleteCaseButton caseStudyId={caseStudy.id} variant="link" />
			</DropdownMenuItem>
		</DropdownMenuContent>
	</DropdownMenu>
);

export default TableActions;

"use client";

import { Blocks } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface LinkedCaseModalProps {
	isOpen: boolean;
	linkedCaseStudies: { id: number; title: string }[];
	loading: boolean;
	onClose: () => void;
}

export const LinkedCaseModal: React.FC<LinkedCaseModalProps> = ({
	isOpen,
	onClose,
	linkedCaseStudies,
	loading,
}) => (
	<Modal
		description="You cannot unpublish this assurance case because it is linked to these case studies."
		isOpen={isOpen}
		onClose={onClose}
		title="Linked Case Studies"
	>
		<div className="mb-4 max-h-60 overflow-y-auto">
			<ul className="space-y-1 text-muted-foreground text-sm">
				{linkedCaseStudies.map((caseStudy) => (
					<li key={caseStudy.id}>
						<Link
							className="flex items-center gap-2 text-primary hover:underline"
							href={`/dashboard/case-studies/${caseStudy.id}`}
							rel="noopener noreferrer"
							target="_blank"
						>
							<Blocks className="size-4" />
							{caseStudy.title}
							<span className="sr-only">(opens in new tab)</span>
						</Link>
					</li>
				))}
			</ul>
		</div>

		<div className="flex w-full justify-end space-x-2 pt-6">
			<Button disabled={loading} onClick={onClose} variant="outline">
				Close
			</Button>
		</div>
	</Modal>
);

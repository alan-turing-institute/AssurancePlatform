"use client";

import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";

interface EditSheetProps {
	title: string;
	description: string | React.ReactNode;
	isOpen: boolean;
	onClose: () => void;
	onChange: (open: boolean) => void;
	children?: React.ReactNode;
	nodeId?: string | number;
}

const EditSheet = ({
	title,
	description,
	isOpen,
	onChange,
	children,
	nodeId,
}: EditSheetProps) => {
	return (
		<Sheet onOpenChange={onChange} open={isOpen}>
			<SheetContent
				className="overflow-y-scroll"
				data-node-id={nodeId}
				data-testid="node-edit"
			>
				<SheetHeader>
					<SheetTitle>{title}</SheetTitle>
					{typeof description === "string" ? (
						<SheetDescription>{description}</SheetDescription>
					) : (
						<div className="text-muted-foreground text-sm">{description}</div>
					)}
				</SheetHeader>
				{children}
			</SheetContent>
		</Sheet>
	);
};

export default EditSheet;

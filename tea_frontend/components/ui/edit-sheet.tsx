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
}

const EditSheet = ({
	title,
	description,
	isOpen,
	onChange,
	children,
}: EditSheetProps) => {
	return (
		<Sheet onOpenChange={onChange} open={isOpen}>
			<SheetContent className="overflow-y-scroll">
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

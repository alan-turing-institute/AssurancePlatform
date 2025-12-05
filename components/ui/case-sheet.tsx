"use client";

import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";

type CaseSheetProps = {
	title: string;
	description: string;
	isOpen: boolean;
	onChange: (open: boolean) => void;
	onClose?: () => void;
	children?: React.ReactNode;
};

const CaseSheet = ({
	title,
	description,
	isOpen,
	onChange,
	children,
}: CaseSheetProps) => (
	<Sheet onOpenChange={onChange} open={isOpen}>
		<SheetContent className="overflow-y-scroll">
			<SheetHeader>
				<SheetTitle>{title}</SheetTitle>
				<SheetDescription>{description}</SheetDescription>
			</SheetHeader>
			{children}
		</SheetContent>
	</Sheet>
);

export default CaseSheet;

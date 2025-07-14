'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface CaseSheetProps {
  title: string;
  description: string;
  isOpen: boolean;
  onClose: () => void;
  onChange: (open: boolean) => void;
  children?: React.ReactNode;
}

const CaseSheet = ({
  title,
  description,
  isOpen,
  onClose,
  onChange,
  children,
}: CaseSheetProps) => {
  return (
    <Sheet open={isOpen} onOpenChange={onChange}>
      <SheetContent className="overflow-y-scroll">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
};

export default CaseSheet;

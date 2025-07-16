'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface CaseSheetProps {
  title: string;
  description: string;
  isOpen: boolean;
  onChange: (open: boolean) => void;
  children?: React.ReactNode;
}

const CaseSheet = ({
  title,
  description,
  isOpen,
  onChange,
  children,
}: CaseSheetProps) => {
  return (
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
};

export default CaseSheet;

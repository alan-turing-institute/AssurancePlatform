'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface NotesSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  title: string;
  description: string;
}

const NotesSheet = ({
  isOpen,
  onClose,
  children,
  title,
  description,
}: NotesSheetProps) => {
  const onChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onChange}>
      <SheetContent className="overflow-y-scroll min-w-full">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
};

export default NotesSheet;

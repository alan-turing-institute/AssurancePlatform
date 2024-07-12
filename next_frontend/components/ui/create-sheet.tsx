'use client'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

interface CreateSheetProps {
  isOpen: boolean
  onClose: () => void
  onChange: (open:boolean) => void
  children?: React.ReactNode
}

const CreateSheet = ({ isOpen, onClose, onChange, children } : CreateSheetProps ) => {
  // const onChange = (open: boolean) => {
  //   if (!open) {
  //     onClose();
  //   }
  // };

  return (
    <Sheet open={isOpen} onOpenChange={onChange}>
      <SheetContent className="overflow-y-scroll">
        <SheetHeader>
          <SheetTitle>Create new Goal</SheetTitle>
          <SheetDescription>
            Please provide some additional information about your goal.
          </SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  )
}

export default CreateSheet

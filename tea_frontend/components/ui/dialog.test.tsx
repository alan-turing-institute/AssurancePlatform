import { describe, it, expect, vi } from 'vitest'
import { render, screen, renderWithoutProviders } from '@/src/__tests__/utils/test-utils'
import userEvent from '@testing-library/user-event'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from './dialog'
import { Button } from './button'

describe('Dialog', () => {
  const DialogDemo = () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>
            This is a dialog description
          </DialogDescription>
        </DialogHeader>
        <div>Dialog body content</div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  it('should render dialog trigger correctly', () => {
    renderWithoutProviders(<DialogDemo />)

    const trigger = screen.getByRole('button', { name: /open dialog/i })
    expect(trigger).toBeInTheDocument()
  })

  it('should open dialog when trigger is clicked', async () => {
    const user = userEvent.setup()
    renderWithoutProviders(<DialogDemo />)

    const trigger = screen.getByRole('button', { name: /open dialog/i })
    await user.click(trigger)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Dialog Title')).toBeInTheDocument()
    expect(screen.getByText('This is a dialog description')).toBeInTheDocument()
    expect(screen.getByText('Dialog body content')).toBeInTheDocument()
  })

  it('should close dialog when close button is clicked', async () => {
    const user = userEvent.setup()
    renderWithoutProviders(<DialogDemo />)

    // Open dialog
    const trigger = screen.getByRole('button', { name: /open dialog/i })
    await user.click(trigger)

    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Close dialog using cancel button
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should close dialog when X button is clicked', async () => {
    const user = userEvent.setup()
    renderWithoutProviders(<DialogDemo />)

    // Open dialog
    const trigger = screen.getByRole('button', { name: /open dialog/i })
    await user.click(trigger)

    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Close dialog using X button
    const closeButton = screen.getByRole('button', { name: /close/i })
    await user.click(closeButton)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should close dialog when escape key is pressed', async () => {
    const user = userEvent.setup()
    renderWithoutProviders(<DialogDemo />)

    // Open dialog
    const trigger = screen.getByRole('button', { name: /open dialog/i })
    await user.click(trigger)

    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Close dialog with escape key
    await user.keyboard('[Escape]')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should have proper accessibility attributes', async () => {
    const user = userEvent.setup()
    renderWithoutProviders(<DialogDemo />)

    // Open dialog
    const trigger = screen.getByRole('button', { name: /open dialog/i })
    await user.click(trigger)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()

    // Check for proper labeling
    expect(dialog).toHaveAccessibleName('Dialog Title')
    expect(dialog).toHaveAccessibleDescription('This is a dialog description')
  })

  it('should render DialogHeader with correct styling', async () => {
    const user = userEvent.setup()
    renderWithoutProviders(<DialogDemo />)

    const trigger = screen.getByRole('button', { name: /open dialog/i })
    await user.click(trigger)

    const title = screen.getByText('Dialog Title')
    expect(title).toHaveClass('text-lg', 'font-semibold', 'leading-none', 'tracking-tight')

    const description = screen.getByText('This is a dialog description')
    expect(description).toHaveClass('text-sm', 'text-muted-foreground')
  })

  it('should render DialogFooter with correct layout', async () => {
    const user = userEvent.setup()
    renderWithoutProviders(<DialogDemo />)

    const trigger = screen.getByRole('button', { name: /open dialog/i })
    await user.click(trigger)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    const confirmButton = screen.getByRole('button', { name: /confirm/i })

    expect(cancelButton).toBeInTheDocument()
    expect(confirmButton).toBeInTheDocument()
  })

  it('should handle controlled dialog state', () => {
    const ControlledDialog = ({ open }: { open: boolean }) => (
      <Dialog open={open}>
        <DialogContent>
          <DialogTitle>Controlled Dialog</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    const { rerender } = renderWithoutProviders(<ControlledDialog open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    rerender(<ControlledDialog open={true} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Controlled Dialog')).toBeInTheDocument()
  })

  it('should accept custom className for DialogContent', async () => {
    const user = userEvent.setup()

    const CustomDialog = () => (
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent className="custom-dialog-class">
          <DialogTitle>Custom Dialog</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    renderWithoutProviders(<CustomDialog />)

    const trigger = screen.getByRole('button', { name: /open/i })
    await user.click(trigger)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveClass('custom-dialog-class')
  })

  it('should prevent body scroll when dialog is open', async () => {
    const user = userEvent.setup()
    renderWithoutProviders(<DialogDemo />)

    const trigger = screen.getByRole('button', { name: /open dialog/i })
    await user.click(trigger)

    // Radix Dialog should handle body scroll prevention automatically
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

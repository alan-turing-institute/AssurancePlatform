'use client';

import {
  Content,
  Group,
  Icon,
  Item,
  ItemIndicator,
  ItemText,
  Label,
  Portal,
  Root,
  ScrollDownButton,
  ScrollUpButton,
  Separator,
  Trigger,
  Value,
  Viewport,
} from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

const Select = Root;

const SelectGroup = Group;

const SelectValue = Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof Trigger>,
  React.ComponentPropsWithoutRef<typeof Trigger>
>(({ className, children, ...props }, ref) => (
  <Trigger
    className={cn(
      'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
      className
    )}
    ref={ref}
    {...props}
  >
    {children}
    <Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </Icon>
  </Trigger>
));
SelectTrigger.displayName = Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof ScrollUpButton>
>(({ className, ...props }, ref) => (
  <ScrollUpButton
    className={cn(
      'flex cursor-default items-center justify-center py-1',
      className
    )}
    ref={ref}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </ScrollUpButton>
));
SelectScrollUpButton.displayName = ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof ScrollDownButton>
>(({ className, ...props }, ref) => (
  <ScrollDownButton
    className={cn(
      'flex cursor-default items-center justify-center py-1',
      className
    )}
    ref={ref}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </ScrollDownButton>
));
SelectScrollDownButton.displayName = ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof Content>,
  React.ComponentPropsWithoutRef<typeof Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <Portal>
    <Content
      className={cn(
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=closed]:animate-out data-[state=open]:animate-in',
        position === 'popper' &&
          'data-[side=left]:-translate-x-1 data-[side=top]:-translate-y-1 data-[side=right]:translate-x-1 data-[side=bottom]:translate-y-1',
        className
      )}
      position={position}
      ref={ref}
      {...props}
    >
      <SelectScrollUpButton />
      <Viewport
        className={cn(
          'p-1',
          position === 'popper' &&
            'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]'
        )}
      >
        {children}
      </Viewport>
      <SelectScrollDownButton />
    </Content>
  </Portal>
));
SelectContent.displayName = Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof Label>,
  React.ComponentPropsWithoutRef<typeof Label>
>(({ className, ...props }, ref) => (
  <Label
    className={cn('py-1.5 pr-2 pl-8 font-semibold text-sm', className)}
    ref={ref}
    {...props}
  />
));
SelectLabel.displayName = Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof Item>,
  React.ComponentPropsWithoutRef<typeof Item>
>(({ className, children, ...props }, ref) => (
  <Item
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    ref={ref}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ItemIndicator>
        <Check className="h-4 w-4" />
      </ItemIndicator>
    </span>

    <ItemText>{children}</ItemText>
  </Item>
));
SelectItem.displayName = Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof Separator>,
  React.ComponentPropsWithoutRef<typeof Separator>
>(({ className, ...props }, ref) => (
  <Separator
    className={cn('-mx-1 my-1 h-px bg-muted', className)}
    ref={ref}
    {...props}
  />
));
SelectSeparator.displayName = Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};

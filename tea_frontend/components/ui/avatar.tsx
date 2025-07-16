'use client';

import {
  Fallback as AvatarFallbackPrimitive,
  Image as AvatarImagePrimitive,
  Root as AvatarRoot,
} from '@radix-ui/react-avatar';
import React from 'react';

import { cn } from '@/lib/utils';

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarRoot>,
  React.ComponentPropsWithoutRef<typeof AvatarRoot>
>(({ className, ...props }, ref) => (
  <AvatarRoot
    className={cn(
      'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
      className
    )}
    ref={ref}
    {...props}
  />
));
Avatar.displayName = AvatarRoot.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarImagePrimitive>,
  React.ComponentPropsWithoutRef<typeof AvatarImagePrimitive>
>(({ className, ...props }, ref) => (
  <AvatarImagePrimitive
    className={cn('aspect-square h-full w-full', className)}
    ref={ref}
    {...props}
  />
));
AvatarImage.displayName = AvatarImagePrimitive.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarFallbackPrimitive>,
  React.ComponentPropsWithoutRef<typeof AvatarFallbackPrimitive>
>(({ className, ...props }, ref) => (
  <AvatarFallbackPrimitive
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-muted',
      className
    )}
    ref={ref}
    {...props}
  />
));
AvatarFallback.displayName = AvatarFallbackPrimitive.displayName;

export { Avatar, AvatarImage, AvatarFallback };

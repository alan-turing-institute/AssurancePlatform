import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Info, ChevronDown } from 'lucide-react';

/**
 * Demo component to test shadcn/ui components in Docusaurus
 * This validates that all components render correctly with glassmorphism theme
 */
export default function ShadcnTestDemo() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-8 space-y-8 bg-gradient-to-br from-gray-900 to-gray-950 rounded-lg">
      <div className="text-text-light mb-6">
        <h2 className="text-2xl font-bold mb-2">shadcn/ui Component Test</h2>
        <p className="text-sm text-text-light/70">
          Testing all installed components with FloraFauna.ai-inspired dark theme
        </p>
      </div>

      {/* Button variants */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-text-light">Button Variants</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="default">Default Button</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
      </div>

      <Separator className="bg-border-transparent" />

      {/* Card with glassmorphism */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-text-light">Card Component</h3>
        <Card className="bg-background-transparent-black border-transparent f-effect-backdrop-blur-lg max-w-md">
          <CardHeader>
            <CardTitle className="text-text-light">Glassmorphic Card</CardTitle>
            <CardDescription className="text-text-light/60">
              Card with backdrop blur and semi-transparent background
            </CardDescription>
          </CardHeader>
          <CardContent className="text-text-light/80">
            This card demonstrates the glassmorphism effect with backdrop blur and
            transparent black background.
          </CardContent>
        </Card>
      </div>

      <Separator className="bg-border-transparent" />

      {/* Dialog */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-text-light">Dialog Component</h3>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">Open Dialog</Button>
          </DialogTrigger>
          <DialogContent className="bg-background-transparent-black-secondaryAlt border-transparent f-effect-backdrop-blur-lg text-text-light">
            <DialogHeader>
              <DialogTitle>Modal Dialog</DialogTitle>
              <DialogDescription className="text-text-light/60">
                This is a glassmorphic dialog with backdrop blur effect
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-text-light/80">
                Dialog content goes here. Notice the glassmorphism styling with the
                dark semi-transparent background and blur effect.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Separator className="bg-border-transparent" />

      {/* Dropdown Menu */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-text-light">Dropdown Menu</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Open Menu
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-background-transparent-black-secondary border-transparent f-effect-backdrop-blur-lg text-text-light">
            <DropdownMenuItem className="hover:bg-background-transparent-white-hover">
              Menu Item 1
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-background-transparent-white-hover">
              Menu Item 2
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-background-transparent-white-hover">
              Menu Item 3
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator className="bg-border-transparent" />

      {/* Tooltip */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-text-light">Tooltip Component</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon">
                <Info className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-background-transparent-black-secondary border-transparent text-text-light">
              <p>This is a tooltip with glassmorphism styling</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Glassmorphism demo boxes */}
      <Separator className="bg-border-transparent" />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-text-light">Glassmorphism Effects</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-morphism p-6 rounded-xl">
            <p className="text-text-light font-semibold mb-2">Base Glassmorphism</p>
            <p className="text-text-light/70 text-sm">
              Using .glass-morphism utility class
            </p>
          </div>

          <div className="bg-background-transparent-black f-effect-backdrop-blur-lg border border-transparent p-6 rounded-xl">
            <p className="text-text-light font-semibold mb-2">Custom Glassmorphism</p>
            <p className="text-text-light/70 text-sm">
              Using .f-effect-backdrop-blur-lg with custom colors
            </p>
          </div>

          <div className="bg-background-transparent-black-secondary f-effect-backdrop-blur-lg border border-transparent shadow-glassmorphic p-6 rounded-xl">
            <p className="text-text-light font-semibold mb-2">Darker Variant</p>
            <p className="text-text-light/70 text-sm">
              More opaque background for better contrast
            </p>
          </div>

          <div className="bg-background-transparent-black-secondaryAlt f-effect-backdrop-blur-lg border-3d p-6 rounded-xl">
            <p className="text-text-light font-semibold mb-2">3D Border Effect</p>
            <p className="text-text-light/70 text-sm">
              Using .border-3d for enhanced depth
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

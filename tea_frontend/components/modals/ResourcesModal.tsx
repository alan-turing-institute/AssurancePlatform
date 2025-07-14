'use client';

import { Modal } from '@/components/ui/modal';
import { useResourcesModal } from '@/hooks/useResourcesModal';
import { cn } from '@/lib/utils';
import {
  BookOpenText,
  Database,
  FolderOpenDot,
  Goal,
  Route,
} from 'lucide-react';
import React from 'react';

export const ResourcesModal = () => {
  const resourcesModal = useResourcesModal();

  const components: {
    title: string;
    icon: any;
    href: string;
    description: string;
  }[] = [
    {
      title: 'Top-Level Goal Claim',
      icon: <Goal />,
      href: 'https://alan-turing-institute.github.io/AssurancePlatform/guidance/components/#goal-claims',
      description:
        'A statement asserting a desirable property or characteristic of the system or technology under consideration.',
    },
    {
      title: 'Property Claim',
      icon: <FolderOpenDot />,
      href: 'https://alan-turing-institute.github.io/AssurancePlatform/guidance/components/#property-claims',
      description:
        'A statement that helps specify the top-level goal claim and defines a measurable requirement for the project or system under consideration',
    },
    {
      title: 'Strategy',
      icon: <Route />,
      href: 'https://alan-turing-institute.github.io/AssurancePlatform/guidance/components/#strategy',
      description:
        'A course of action or approach that can help break the task of assuring a top-level goal claim into a set of related property claims.',
    },
    {
      title: 'Evidence',
      icon: <Database />,
      href: 'https://alan-turing-institute.github.io/AssurancePlatform/guidance/components/#evidence',
      description:
        "An artefact that justifies a linked property claim's validity and grounds an assurance case.",
    },
    {
      title: 'Context',
      icon: <BookOpenText />,
      href: 'https://alan-turing-institute.github.io/AssurancePlatform/guidance/components/#context',
      description:
        'Additional information that clarifies the scope or boundary conditions of a top-level goal claim.',
    },
  ];

  return (
    <Modal
      title="Element Legend"
      description="Here is some useful information about each element, select each to find out more."
      isOpen={resourcesModal.isOpen}
      onClose={resourcesModal.onClose}
      classNames="min-w-[800px]"
    >
      <ul className="grid gap-3 py-2 md:grid-cols-2">
        {components.map((component) => (
          <ListItem
            key={component.title}
            href={component.href}
            target="_blank"
            className="group"
          >
            <div className="flex justify-start items-center gap-3 text-foreground pb-2 font-bold group-hover:text-white">
              {component.icon}
              {component.title}
            </div>
            {component.description}
          </ListItem>
        ))}
      </ul>
    </Modal>
  );
};

const ListItem = React.forwardRef<
  React.ElementRef<'a'>,
  React.ComponentPropsWithoutRef<'a'>
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <a
        ref={ref}
        className={cn(
          'block group select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none hover:bg-indigo-500 dark:hover:bg-indigo-700 hover:text-accent-foreground',
          className
        )}
        {...props}
      >
        <div className="text-sm font-medium leading-none group-hover:text-white">
          {title}
        </div>
        <p className="text-sm leading-snug text-muted-foreground group-hover:text-white">
          {children}
        </p>
      </a>
    </li>
  );
});
ListItem.displayName = 'ListItem';

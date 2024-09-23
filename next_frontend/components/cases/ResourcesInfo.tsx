"use client"

import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { BookOpenText, Database, FolderOpenDot, Goal, Route } from "lucide-react"

const components: { title: string; icon: any; href: string, description: string }[] = [
  {
    title: "Top-Level Goal Claim",
    icon: <Goal />,
    href:"https://alan-turing-institute.github.io/AssurancePlatform/guidance/components/#goal-claims",
    description:
      "A statement asserting a desirable property or characteristic of the system or technology under consideration.",
  },
  {
    title: "Property Claim",
    icon: <FolderOpenDot />,
    href:"https://alan-turing-institute.github.io/AssurancePlatform/guidance/components/#property-claims",
    description:
      "A statement that helps specify the top-level goal claim and defines a measurable requirement for the project or system under consideration",
  },
  {
    title: "Strategy",
    icon: <Route />,
    href:"https://alan-turing-institute.github.io/AssurancePlatform/guidance/components/#strategy",
    description:
      "A course of action or approach that can help break the task of assuring a top-level goal claim into a set of related property claims.",
  },
  {
    title: "Evidence",
    icon: <Database />,
    href:"https://alan-turing-institute.github.io/AssurancePlatform/guidance/components/#evidence",
    description: "An artefact that justifies a linked property claim's validity and grounds an assurance case.",
  },
  {
    title: "Context",
    icon: <BookOpenText />,
    href:"https://alan-turing-institute.github.io/AssurancePlatform/guidance/components/#context",
    description:
      "Additional information that clarifies the scope or boundary conditions of a top-level goal claim.",
  },
]

export function ResourcesInfo() {
  return (
    <NavigationMenu className="hidden sm:block">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger className="bg-indigo-600 hover:bg-indigo-700 hover:text-white dark:bg-slate-900 dark:hover:bg-slate-800">Resources</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
              {components.map((component) => (
                <ListItem
                  key={component.title}
                  // title={component.title}
                  href={component.href}
                  target="_blank"
                >
                  <div className="flex justify-start items-center gap-3 text-foreground pb-2 font-bold">
                    {component.icon}
                    {component.title}
                  </div>
                  {component.description}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}

const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a">
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            className
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  )
})
ListItem.displayName = "ListItem"

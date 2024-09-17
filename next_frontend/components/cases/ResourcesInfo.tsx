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
        {/* <NavigationMenuItem>
          <NavigationMenuTrigger>Getting started</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
              <li className="row-span-3">
                <NavigationMenuLink asChild>
                  <a
                    className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                    href="/"
                  >
                    icon
                    <div className="mb-2 mt-4 text-lg font-medium">
                      shadcn/ui
                    </div>
                    <p className="text-sm leading-tight text-muted-foreground">
                      Beautifully designed components that you can copy and
                      paste into your apps. Accessible. Customizable. Open
                      Source.
                    </p>
                  </a>
                </NavigationMenuLink>
              </li>
              <ListItem href="/docs" title="Introduction">
                Re-usable components built using Radix UI and Tailwind CSS.
              </ListItem>
              <ListItem href="/docs/installation" title="Installation">
                How to install dependencies and structure your app.
              </ListItem>
              <ListItem href="/docs/primitives/typography" title="Typography">
                Styles for headings, paragraphs, lists...etc
              </ListItem>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem> */}
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
                // <div key={component.title} className="flex flex-col justify-start items-start gap-2 py-2 px-4">
                //   <div className="flex justify-start items-center gap-3">
                //     {component.icon}
                //     <p className="text-sm font-bold">{component.title}</p>
                //   </div>
                //   <p className="text-sm text-muted-foreground">{component.description}</p>
                // </div>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        {/* <NavigationMenuItem>
          <Link href="https://alan-turing-institute.github.io/AssurancePlatform/" legacyBehavior passHref>
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              Documentation
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem> */}
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

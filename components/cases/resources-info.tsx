"use client";

import {
	BookOpenText,
	Database,
	FolderOpenDot,
	Goal,
	Route,
} from "lucide-react";
import React from "react";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";

const components: {
	title: string;
	icon: React.ReactNode;
	href: string;
	description: string;
}[] = [
	{
		title: "Top-Level Goal Claim",
		icon: <Goal />,
		href: "/docs/curriculum/quick-reference/02-element-types#goal-claims",
		description:
			"A statement asserting a desirable property or characteristic of the system or technology under consideration.",
	},
	{
		title: "Property Claim",
		icon: <FolderOpenDot />,
		href: "/docs/curriculum/quick-reference/02-element-types#property-claims",
		description:
			"A statement that helps specify the top-level goal claim and defines a measurable requirement for the project or system under consideration",
	},
	{
		title: "Strategy",
		icon: <Route />,
		href: "/docs/curriculum/quick-reference/02-element-types#strategies",
		description:
			"A course of action or approach that can help break the task of assuring a top-level goal claim into a set of related property claims.",
	},
	{
		title: "Evidence",
		icon: <Database />,
		href: "/docs/curriculum/quick-reference/02-element-types#evidence",
		description:
			"An artefact that justifies a linked property claim's validity and grounds an assurance case.",
	},
	{
		title: "Context",
		icon: <BookOpenText />,
		href: "/docs/curriculum/quick-reference/02-element-types#context",
		description:
			"Additional information that clarifies the scope or boundary conditions of a top-level goal claim.",
	},
];

export function ResourcesInfo() {
	return (
		<NavigationMenu className="hidden sm:block">
			<NavigationMenuList>
				<NavigationMenuItem>
					<NavigationMenuTrigger className="bg-indigo-600 hover:bg-indigo-700 hover:text-white dark:bg-slate-900 dark:hover:bg-slate-800">
						Resources
					</NavigationMenuTrigger>
					<NavigationMenuContent>
						<ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
							{components.map((component) => (
								<ListItem
									href={component.href}
									// title={component.title}
									key={component.title}
									target="_blank"
								>
									<div className="flex items-center justify-start gap-3 pb-2 font-bold text-foreground">
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
	);
}

const ListItem = React.forwardRef<
	React.ElementRef<"a">,
	React.ComponentPropsWithoutRef<"a">
>(({ className, title, children, ...props }, ref) => (
	<li>
		<NavigationMenuLink asChild>
			<a
				className={cn(
					"block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
					className
				)}
				ref={ref}
				{...props}
			>
				<div className="font-medium text-sm leading-none">{title}</div>
				<p className="text-muted-foreground text-sm leading-snug">{children}</p>
			</a>
		</NavigationMenuLink>
	</li>
));
ListItem.displayName = "ListItem";

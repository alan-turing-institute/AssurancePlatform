"use client";

import { BookOpen, Github, Menu } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

type DocsNavbarProps = {
	/** Optional className for the navbar */
	className?: string;
	/** Callback to toggle mobile sidebar */
	onMenuToggle?: () => void;
};

/**
 * DocsNavbar - Top navigation bar for documentation pages.
 *
 * Features:
 * - Logo and branding
 * - Links to main sections
 * - Theme toggle
 * - GitHub link
 * - Mobile menu button
 */
export function DocsNavbar({ className, onMenuToggle }: DocsNavbarProps) {
	return (
		<header
			className={cn(
				"sticky top-0 z-50 h-16 w-full",
				"border-border border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
				className
			)}
		>
			<div className="flex h-full items-center justify-between px-4 lg:px-6">
				{/* Left section - Logo and mobile menu */}
				<div className="flex items-center gap-4">
					{onMenuToggle && (
						<Button
							className="lg:hidden"
							onClick={onMenuToggle}
							size="icon"
							variant="ghost"
						>
							<Menu className="h-5 w-5" />
							<span className="sr-only">Toggle menu</span>
						</Button>
					)}
					<Link className="flex items-center gap-2" href="/docs">
						<BookOpen className="h-6 w-6 text-primary" />
						<span className="font-bold text-lg">TEA Docs</span>
					</Link>
				</div>

				{/* Center section - Navigation links */}
				<nav className="hidden items-center gap-6 md:flex">
					<Link
						className="text-muted-foreground text-sm transition-colors hover:text-foreground"
						href="/docs"
					>
						Documentation
					</Link>
					<Link
						className="text-muted-foreground text-sm transition-colors hover:text-foreground"
						href="/docs/curriculum"
					>
						Curriculum
					</Link>
					<Link
						className="text-muted-foreground text-sm transition-colors hover:text-foreground"
						href="/docs/api-reference"
					>
						API
					</Link>
				</nav>

				{/* Right section - Actions */}
				<div className="flex items-center gap-2">
					<Button asChild size="icon" variant="ghost">
						<a
							href="https://github.com/alan-turing-institute/AssurancePlatform"
							rel="noopener noreferrer"
							target="_blank"
						>
							<Github className="h-5 w-5" />
							<span className="sr-only">GitHub</span>
						</a>
					</Button>
					<ModeToggle />
				</div>
			</div>
		</header>
	);
}

export default DocsNavbar;

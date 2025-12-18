import { BookOpen, Clock } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

/**
 * Module metadata for displaying header badges
 */
export type ModuleMetadata = {
	/** Module title (typically from frontmatter) */
	title: string;
	/** Estimated time to complete the module (e.g., "20-30 minutes") */
	duration: string;
	/** List of prerequisite module paths and their display names */
	prerequisites?: Array<{
		/** URL path to the prerequisite module */
		path: string;
		/** Display name for the prerequisite */
		name: string;
	}>;
};

type ModuleHeaderProps = {
	/** Module metadata containing title, duration and prerequisites */
	metadata: ModuleMetadata;
};

/**
 * ModuleHeader - Display module title and metadata badges
 *
 * Renders the module title as an H1 and shows duration and prerequisite badges.
 * Prerequisites are rendered as clickable links to the relevant modules.
 */
const ModuleHeader = ({ metadata }: ModuleHeaderProps): React.ReactNode => {
	const { title, duration, prerequisites = [] } = metadata;

	return (
		<div className="mb-8">
			<h1 className="mb-4 font-bold text-4xl tracking-tight">{title}</h1>
			<div className="flex flex-wrap items-center gap-3">
				{/* Duration Badge */}
				<Badge
					className="gap-1.5 bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
					variant="secondary"
				>
					<Clock className="h-3.5 w-3.5" />
					{duration}
				</Badge>

				{/* Prerequisites Badges */}
				{prerequisites.length > 0 && (
					<>
						<span className="text-gray-400 text-sm">|</span>
						<span className="flex items-center gap-1.5 text-gray-600 text-sm dark:text-gray-400">
							<BookOpen className="h-3.5 w-3.5" />
							Prerequisites:
						</span>
						{prerequisites.map((prereq) => (
							<Link href={prereq.path} key={prereq.path}>
								<Badge
									className="cursor-pointer gap-1.5 bg-amber-100 text-amber-800 transition-colors hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
									variant="secondary"
								>
									{prereq.name}
								</Badge>
							</Link>
						))}
					</>
				)}

				{/* No prerequisites message */}
				{prerequisites.length === 0 && (
					<>
						<span className="text-gray-400 text-sm">|</span>
						<Badge
							className="gap-1.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
							variant="secondary"
						>
							<BookOpen className="h-3.5 w-3.5" />
							No prerequisites
						</Badge>
					</>
				)}
			</div>
		</div>
	);
};

export default ModuleHeader;

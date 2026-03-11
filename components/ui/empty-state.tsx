import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
	icon?: LucideIcon;
	title: string;
	message: string;
	children?: React.ReactNode;
};

export function EmptyState({
	icon: Icon,
	title,
	message,
	children,
}: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			{Icon && (
				<Icon aria-hidden="true" className="mb-4 h-12 w-12 text-muted-foreground/50" />
			)}
			<h3 className="mb-2 font-medium text-lg">{title}</h3>
			<p className="text-muted-foreground text-sm">{message}</p>
			{children && <div className="mt-6">{children}</div>}
		</div>
	);
}

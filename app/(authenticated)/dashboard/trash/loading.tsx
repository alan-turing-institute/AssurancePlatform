import { Skeleton } from "@/components/ui/skeleton";

export default function TrashLoading() {
	return (
		<div className="min-h-screen space-y-4 p-8">
			<div>
				<Skeleton className="h-7 w-24" />
				<Skeleton className="mt-2 h-4 w-80" />
			</div>
			<Skeleton className="h-px w-full" />
			<div className="mt-8 space-y-3">
				<Skeleton className="h-10 w-full" />
				{Array.from({ length: 3 }).map((_, i) => (
					<Skeleton
						className="h-16 w-full"
						key={`trash-skeleton-${i.toString()}`}
					/>
				))}
			</div>
		</div>
	);
}

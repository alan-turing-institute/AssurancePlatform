import { Skeleton } from "@/components/ui/skeleton";

export default function CaseStudiesLoading() {
	return (
		<div className="min-h-screen space-y-4 p-8">
			<div className="md:flex md:items-center md:justify-between">
				<div>
					<Skeleton className="h-7 w-48" />
					<Skeleton className="mt-2 h-4 w-72" />
				</div>
				<Skeleton className="mt-4 h-10 w-32 md:mt-0" />
			</div>
			<Skeleton className="h-px w-full" />
			<div className="mt-8 space-y-3">
				<Skeleton className="h-10 w-full" />
				{Array.from({ length: 5 }).map((_, i) => (
					<Skeleton
						className="h-16 w-full"
						key={`study-skeleton-${i.toString()}`}
					/>
				))}
			</div>
		</div>
	);
}

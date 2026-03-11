import { Skeleton } from "@/components/ui/skeleton";

export default function TeamsLoading() {
	return (
		<div className="flex min-h-screen flex-col items-start justify-start px-4 pb-16 sm:px-6 lg:px-8">
			<div className="flex w-full items-start justify-between gap-6 py-6">
				<Skeleton className="h-10 w-1/3" />
				<Skeleton className="h-10 w-28" />
			</div>
			<div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton
						className="h-[200px] rounded-lg"
						key={`team-skeleton-${i.toString()}`}
					/>
				))}
			</div>
		</div>
	);
}

import { Skeleton } from "@/components/ui/skeleton";

export default function AuthenticatedLoading() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center px-4">
			<Skeleton className="h-12 w-48" />
		</div>
	);
}

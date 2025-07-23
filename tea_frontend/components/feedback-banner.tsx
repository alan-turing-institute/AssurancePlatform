import { XMarkIcon } from "@heroicons/react/20/solid";
import { MessageSquareMore } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function FeedbackBanner() {
	const [showBanner, setShowBanner] = useState<boolean>(true);

	if (!showBanner) {
		return null;
	}

	return (
		<div className="flex items-center gap-x-6 bg-slate-900 px-6 py-2.5 sm:px-3.5 sm:before:flex-1 dark:bg-violet-600">
			<div className="w-full text-sm text-white leading-6">
				<Link
					className="flex w-full flex-col items-center justify-center gap-2 py-3 md:flex-row md:py-0"
					href="https://alan-turing-institute.github.io/AssurancePlatform/community/community-support/"
				>
					<div className="flex items-center justify-start gap-2">
						<MessageSquareMore className="h-4 w-4" />
						<strong className="font-semibold">Feedback</strong>
					</div>
					<svg
						aria-hidden="true"
						className="mx-2 hidden h-0.5 w-0.5 fill-current md:block"
						viewBox="0 0 2 2"
					>
						<circle cx={1} cy={1} r={1} />
					</svg>
					We would love to hear your feedback! &nbsp;
					<span aria-hidden="true" className="hidden md:block">
						&rarr;
					</span>
				</Link>
			</div>
			<div className="flex flex-1 justify-end">
				<button
					className="-m-3 p-3 focus-visible:outline-offset-[-4px]"
					type="button"
				>
					<span className="sr-only">Dismiss</span>
					<XMarkIcon
						aria-hidden="true"
						className="hidden h-5 w-5 text-white md:block"
						onClick={() => setShowBanner(false)}
					/>
				</button>
			</div>
		</div>
	);
}

"use client";

import { MessageCircleWarning } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function PreviewBanner() {
	const [showBanner, _setShowBanner] = useState<boolean>(true);

	if (!showBanner) {
		return null;
	}

	return (
		<div className="fixed bottom-0 left-0 w-full">
			<div className="flex items-center justify-center gap-x-6 bg-rose-500 px-6 py-4 sm:px-3.5">
				<div className="text-sm text-white leading-6">
					<Link
						className="flex items-center justify-start gap-2"
						href="https://alan-turing-institute.github.io/AssurancePlatform/community/community-support/"
					>
						<MessageCircleWarning className="hidden h-4 w-4 md:block" />
						<div className="flex flex-col items-start justify-start gap-2 md:flex-row md:items-center">
							<strong className="hidden font-semibold md:block">
								Research Preview
							</strong>
							<svg
								aria-hidden="true"
								className="mx-2 hidden h-0.5 w-0.5 fill-current md:inline"
								viewBox="0 0 2 2"
							>
								<circle cx={1} cy={1} r={1} />
							</svg>
							<span>
								As this is <span className="font-bold">preview only</span> it
								should not to be used for business critical use cases.
							</span>
						</div>
					</Link>
				</div>
				{/* <div className="flex flex-1 justify-end">
          <button type="button" className="-m-3 p-3 focus-visible:outline-offset-[-4px]">
            <span className="sr-only">Dismiss</span>
            <XMarkIcon onClick={() => setShowBanner(false)} className="h-5 w-5 text-white" aria-hidden="true" />
          </button>
        </div> */}
			</div>
		</div>
	);
}

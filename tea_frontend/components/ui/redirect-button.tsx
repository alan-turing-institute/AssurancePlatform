"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface RedirectButtonProps {
	label: string;
	url: string;
}

const RedirectButton = ({ label, url }: RedirectButtonProps) => {
	const _router = useRouter();

	return (
		<Link
			className="ml-3 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 font-semibold text-sm text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
			href={url}
		>
			{label}
		</Link>
	);
};

export default RedirectButton;

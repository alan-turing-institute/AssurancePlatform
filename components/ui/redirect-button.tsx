"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type RedirectButtonProps = {
	label: string;
	url: string;
};

const RedirectButton = ({ label, url }: RedirectButtonProps) => {
	const _router = useRouter();

	return (
		<Button asChild className="ml-3" variant="default">
			<Link href={url}>
				{label}
			</Link>
		</Button>
	);
};

export default RedirectButton;

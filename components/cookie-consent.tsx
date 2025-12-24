"use client";

import { CookieIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

type CookieConsentProps = {
	demo?: boolean;
	onAcceptCallback?: () => void;
	onDeclineCallback?: () => void;
};

export default function CookieConsent({
	demo = false,
	onAcceptCallback = () => {
		// Default accept callback
	},
	onDeclineCallback = () => {
		// Default decline callback
	},
}: CookieConsentProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [hide, setHide] = useState(false);

	const router = useRouter();

	const accept = () => {
		setIsOpen(false);
		// biome-ignore lint/suspicious/noDocumentCookie: Essential cookie for consent tracking
		document.cookie =
			"cookieConsent=true; expires=Fri, 31 Dec 9999 23:59:59 GMT";
		setTimeout(() => {
			setHide(true);
		}, 700);
		onAcceptCallback();
	};

	const _decline = () => {
		setIsOpen(false);
		setTimeout(() => {
			setHide(true);
		}, 700);
		onDeclineCallback();
	};

	useEffect(() => {
		try {
			setIsOpen(true);
			if (document.cookie.includes("cookieConsent=true") && !demo) {
				setIsOpen(false);
				setTimeout(() => {
					setHide(true);
				}, 700);
			}
		} catch (_e) {
			// console.log("Error: ", e);
		}
	}, [demo]);

	return (
		<div
			className={cn(
				"fixed right-0 bottom-0 left-0 z-200 w-full duration-700 sm:bottom-4 sm:left-4 sm:max-w-md",
				isOpen
					? "translate-y-0 opacity-100 transition-[opacity,transform]"
					: "translate-y-8 opacity-0 transition-[opacity,transform]",
				hide && "hidden"
			)}
		>
			<div className="m-3 rounded-lg border border-border bg-background dark:bg-card">
				<div className="flex items-center justify-between p-3">
					<h1 className="font-medium text-lg">We use cookies</h1>
					<CookieIcon className="h-[1.2rem] w-[1.2rem]" />
				</div>
				<div className="-mt-2 p-3">
					<p className="text-left text-muted-foreground text-sm">
						This site uses essential cookies to support authentication of
						registered users only.
					</p>
				</div>
				<div className="mt-2 flex items-center gap-2 border-t p-3">
					<Button
						className="h-9 w-full rounded-full"
						onClick={accept}
						variant="default"
					>
						Okay
					</Button>
					<Button
						className="h-9 w-full rounded-full"
						onClick={() => router.push("/cookie-policy")}
						variant={"outline"}
					>
						Read More
					</Button>
					{/* <Button
                        onClick={decline}
                        className="w-full h-9 rounded-full"
                        variant="outline"
                    >
                        Decline
                    </Button> */}
				</div>
			</div>
		</div>
	);
}

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * The assistant card's settings line. The assistant has no settings of its
 * own: the models it uses are set in the AI models block under the cards.
 */
export function AiModelsPointer() {
	return (
		<p className="text-muted-foreground text-sm">
			This plugin uses the models set in{" "}
			<Button asChild className="h-auto p-0" variant="link">
				<Link href="#ai-models">AI models</Link>
			</Button>{" "}
			below.
		</p>
	);
}

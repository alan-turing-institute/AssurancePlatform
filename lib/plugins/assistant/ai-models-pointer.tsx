"use client";

import Link from "next/link";

/**
 * The assistant card's settings line. The assistant has no settings of its
 * own: the models it uses are set in the AI models block under the cards.
 */
export function AiModelsPointer() {
	return (
		<p className="text-muted-foreground text-sm">
			This plugin uses the models set in{" "}
			<Link className="underline" href="#ai-models">
				AI models
			</Link>{" "}
			below.
		</p>
	);
}

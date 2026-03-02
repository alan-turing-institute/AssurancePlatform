import { sanitizeDescription } from "@/lib/sanitize-html";

type SanitisedHtmlProps = {
	html: string;
	className?: string;
};

export const SanitisedHtml = ({ html, className }: SanitisedHtmlProps) => (
	<div
		className={className}
		dangerouslySetInnerHTML={{ __html: sanitizeDescription(html) }}
	/>
);

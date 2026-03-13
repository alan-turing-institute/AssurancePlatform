import { sanitizeDescription } from "@/lib/sanitize-html";

interface SanitisedHtmlProps {
	className?: string;
	html: string;
}

export const SanitisedHtml = ({ html, className }: SanitisedHtmlProps) => (
	<div
		className={className}
		dangerouslySetInnerHTML={{ __html: sanitizeDescription(html) }}
	/>
);

import { sanitizeDescription } from "@/lib/sanitize-html";

type SanitizedHtmlProps = {
	html: string;
	className?: string;
};

export const SanitizedHtml = ({ html, className }: SanitizedHtmlProps) => (
	<div
		className={className}
		dangerouslySetInnerHTML={{ __html: sanitizeDescription(html) }}
	/>
);

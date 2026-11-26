import type { ReactNode } from "react";

/**
 * A stand-in for `@react-pdf/renderer` that draws each part as a plain element
 * marked with `data-pdf`, plus readers over what the app's components hand to
 * it. Styles are dropped; only content and structure are kept.
 *
 * In a test file the mock is one line, because mocks are hoisted above imports:
 * `vi.mock("@react-pdf/renderer", async () => (await import("@/src/__tests__/utils/export-pdf-kit")).pdfStandIn);`
 */

interface WithChildren {
	children?: ReactNode;
	fixed?: boolean;
}

interface DocumentProps extends WithChildren {
	author?: string;
	creator?: string;
	subject?: string;
	title?: string;
}

interface PageProps extends WithChildren {
	orientation?: string;
	size?: string;
}

interface TextProps extends WithChildren {
	render?: (info: { pageNumber: number; totalPages: number }) => ReactNode;
}

function fixedMark(fixed: boolean | undefined): string | undefined {
	return fixed ? "true" : undefined;
}

function Document({
	children,
	title,
	author,
	subject,
	creator,
}: DocumentProps) {
	return (
		<div
			data-author={author}
			data-creator={creator}
			data-pdf="document"
			data-subject={subject}
			data-title={title}
		>
			{children}
		</div>
	);
}

function Page({ children, orientation, size }: PageProps) {
	return (
		<div data-orientation={orientation} data-pdf="page" data-size={size}>
			{children}
		</div>
	);
}

function View({ children, fixed }: WithChildren) {
	return (
		<div data-fixed={fixedMark(fixed)} data-pdf="view">
			{children}
		</div>
	);
}

/** A text drawn with a page-number function shows page 1 of 1. */
function Text({ children, render, fixed }: TextProps) {
	return (
		<span data-fixed={fixedMark(fixed)} data-pdf="text">
			{render ? render({ pageNumber: 1, totalPages: 1 }) : children}
		</span>
	);
}

function Image({ src }: { src?: string }) {
	return <span data-pdf="image" data-src={src} />;
}

function Link({ children, src }: WithChildren & { src?: string }) {
	return (
		<a data-pdf="link" href={src}>
			{children}
		</a>
	);
}

// fallow-ignore-next-line unused-export
export const pdfStandIn = {
	Document,
	Page,
	View,
	Text,
	Image,
	Link,
	StyleSheet: { create: <T,>(styles: T): T => styles },
	pdf: () => ({ toBlob: async () => new Blob(["pdf"]) }),
};

export type PdfOutline =
	| string
	| { image: string }
	| { link: string; content: PdfOutline[] }
	| PdfOutline[];

function partOf(element: Element): string | null {
	return element.getAttribute("data-pdf");
}

function isFixed(element: Element): boolean {
	return element.getAttribute("data-fixed") === "true";
}

/** What an element holds, as nested lists: a text as its string, an image as its source, a link as its address and content. */
function pdfOutline(element: Element): PdfOutline {
	const part = partOf(element);
	if (part === "text") {
		return element.textContent ?? "";
	}
	if (part === "image") {
		return { image: element.getAttribute("data-src") ?? "" };
	}
	const content = Array.from(element.children).map(pdfOutline);
	if (part === "link") {
		return { link: element.getAttribute("href") ?? "", content };
	}
	return content;
}

/** The pages, in order. */
export function pdfPages(root: ParentNode): Element[] {
	return Array.from(root.querySelectorAll('[data-pdf="page"]'));
}

/** What a page holds apart from the parts repeated on every page (the fixed ones). */
export function pdfBody(page: Element): PdfOutline[] {
	return Array.from(page.children)
		.filter((child) => !isFixed(child))
		.map(pdfOutline);
}

/** What a page repeats on every page it spreads over (the fixed parts). */
export function pdfFixed(page: Element): PdfOutline[] {
	return Array.from(page.children).filter(isFixed).map(pdfOutline);
}

/** The orientation each page was given, in order; none was given for portrait. */
export function pdfOrientations(root: ParentNode): (string | null)[] {
	return pdfPages(root).map((page) => page.getAttribute("data-orientation"));
}

/** The title, author, subject and creator the document was given. */
export function pdfProperties(root: ParentNode) {
	const document = root.querySelector('[data-pdf="document"]');
	return {
		title: document?.getAttribute("data-title"),
		author: document?.getAttribute("data-author"),
		subject: document?.getAttribute("data-subject"),
		creator: document?.getAttribute("data-creator"),
	};
}

/** The text blocks under an element, in order. A text inside another text counts once. */
export function pdfTexts(root: ParentNode): string[] {
	return Array.from(root.querySelectorAll('[data-pdf="text"]'))
		.filter((text) => !text.parentElement?.closest('[data-pdf="text"]'))
		.map((text) => text.textContent ?? "");
}

/** The source of each image under an element, in order. */
export function pdfImages(root: ParentNode): string[] {
	return Array.from(root.querySelectorAll('[data-pdf="image"]')).map(
		(image) => image.getAttribute("data-src") ?? ""
	);
}

/** The address and text of each link under an element, in order. */
export function pdfLinks(root: ParentNode): { href: string; text: string }[] {
	return Array.from(root.querySelectorAll('[data-pdf="link"]')).map((link) => ({
		href: link.getAttribute("href") ?? "",
		text: link.textContent ?? "",
	}));
}

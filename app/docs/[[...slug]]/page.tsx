import {
	DocsBody,
	DocsDescription,
	DocsPage,
	DocsTitle,
	EditOnGitHub,
} from "fumadocs-ui/layouts/docs/page";
import { notFound } from "next/navigation";
import { tocDepthForUrl } from "@/lib/docs/toc-depth";
import { source } from "@/lib/docs-source";
import { getMDXComponents } from "@/mdx-components";

export function generateStaticParams() {
	return source.generateParams();
}

export async function generateMetadata(props: {
	params: Promise<{ slug?: string[] }>;
}) {
	const params = await props.params;
	const page = source.getPage(params.slug);

	if (!page) {
		notFound();
	}

	return {
		title: page.data.title,
		description: page.data.description,
	};
}

export default async function Page(props: {
	params: Promise<{ slug?: string[] }>;
}) {
	const params = await props.params;
	const page = source.getPage(params.slug);

	if (!page) {
		notFound();
	}

	const MDXContent = page.data.body;

	// Cap the table of contents per page (F10/F11) — see tocDepthForUrl's
	// docstring for why the changelog gets a shallower cap than every other
	// docs page.
	const maxTocDepth = tocDepthForUrl(page.url);
	const toc = page.data.toc.filter((item) => item.depth <= maxTocDepth);

	return (
		<DocsPage toc={toc}>
			<DocsTitle>{page.data.title}</DocsTitle>
			<DocsDescription>{page.data.description}</DocsDescription>
			<EditOnGitHub
				className="w-fit self-start"
				href={`https://github.com/alan-turing-institute/AssurancePlatform/tree/main/content/${page.path}`}
			/>
			<DocsBody>
				<MDXContent components={getMDXComponents()} />
			</DocsBody>
		</DocsPage>
	);
}

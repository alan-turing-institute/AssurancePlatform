import {
	DocsBody,
	DocsDescription,
	DocsPage,
	DocsTitle,
	EditOnGitHub,
} from "fumadocs-ui/layouts/docs/page";
import { notFound } from "next/navigation";
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

	return (
		<DocsPage toc={page.data.toc}>
			<DocsTitle>{page.data.title}</DocsTitle>
			<DocsDescription>{page.data.description}</DocsDescription>
			<EditOnGitHub
				href={`https://github.com/alan-turing-institute/AssurancePlatform/tree/main/content/${page.path}`}
			/>
			<DocsBody>
				<MDXContent components={getMDXComponents()} />
			</DocsBody>
		</DocsPage>
	);
}

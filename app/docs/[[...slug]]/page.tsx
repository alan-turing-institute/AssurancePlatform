import { generateStaticParamsFor, importPage } from "nextra/pages";
import { getMDXComponents } from "../../../mdx-components";

export const generateStaticParams = generateStaticParamsFor("slug");

export async function generateMetadata(props: {
	params: Promise<{ slug?: string[] }>;
}) {
	const params = await props.params;
	const { metadata } = await importPage(params.slug ?? []);
	return metadata;
}

// Get the wrapper component from MDX components (not a hook, just a function)
const Wrapper = getMDXComponents().wrapper;

export default async function Page(props: {
	params: Promise<{ slug?: string[] }>;
}) {
	const params = await props.params;
	const result = await importPage(params.slug ?? []);
	const { default: MDXContent, toc, metadata } = result;

	return (
		<Wrapper metadata={metadata} sourceCode={""} toc={toc}>
			<MDXContent {...props} params={params} />
		</Wrapper>
	);
}

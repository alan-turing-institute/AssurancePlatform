import { getPageMap } from "nextra/page-map";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import type { ReactNode } from "react";

export const metadata = {
	title: {
		default: "TEA Documentation",
		template: "%s | TEA Documentation",
	},
	description: "Trustworthy and Ethical Assurance Platform Documentation",
};

type DocsLayoutPageProps = {
	children: ReactNode;
};

const navbar = (
	<Navbar
		logo={
			<span className="flex items-center gap-2 font-bold">
				<svg
					aria-hidden="true"
					className="h-6 w-6"
					fill="none"
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					viewBox="0 0 24 24"
				>
					<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
				</svg>
				TEA Docs
			</span>
		}
		projectLink="https://github.com/alan-turing-institute/AssurancePlatform"
	/>
);

const footer = (
	<Footer>
		<div className="flex w-full flex-col items-center sm:flex-row sm:justify-between">
			<span>MIT {new Date().getFullYear()} © Alan Turing Institute</span>
			<span className="text-gray-500 text-sm">
				Trustworthy and Ethical Assurance Platform
			</span>
		</div>
	</Footer>
);

export default async function DocsLayoutPage({
	children,
}: DocsLayoutPageProps) {
	const pageMap = await getPageMap("/docs");

	return (
		<Layout
			docsRepositoryBase="https://github.com/alan-turing-institute/AssurancePlatform/tree/main/content"
			editLink="Edit this page on GitHub"
			footer={footer}
			navbar={navbar}
			pageMap={pageMap}
			sidebar={{ defaultMenuCollapseLevel: 1 }}
		>
			{children}
		</Layout>
	);
}

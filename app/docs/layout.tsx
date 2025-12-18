import Image from "next/image";
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
			<div className="flex items-center gap-2">
				<Image
					alt="TEA Platform"
					className="dark:hidden"
					height={28}
					src="/images/logos/tea-logo-icon-light.png"
					width={32}
				/>
				<Image
					alt="TEA Platform"
					className="hidden dark:block"
					height={28}
					src="/images/logos/tea-logo-icon-dark.png"
					width={32}
				/>
				<span className="font-bold text-lg">TEA Docs</span>
			</div>
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

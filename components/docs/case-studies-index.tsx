import Link from "next/link";
import type { MdxFile, PageMapItem } from "nextra";
import { getPageMap } from "nextra/page-map";

const CASE_STUDIES_ROUTE = "/docs/curriculum/hands-on/case-studies";

interface CaseStudyFrontMatter {
	assurance_goal?: string;
	description?: string;
	domain?: string;
	sidebar_position?: number;
	title?: string;
}

interface CaseStudyEntry {
	assurance_goal: string;
	description: string;
	domain: string;
	href: string;
	sidebar_position: number;
	slug: string;
	title: string;
}

/**
 * Extracts case-study entries from the Nextra page map for a given route.
 *
 * Nextra bakes frontmatter into the page map at build time — including custom
 * fields added to MDX files — so this works identically in dev and production
 * standalone output without any runtime filesystem reads.
 *
 * Excluded: the index page itself, `_meta` config entries, and any underscore-
 * prefixed files (templates, workshop notes, etc.).
 */
export async function getCaseStudyEntries(): Promise<CaseStudyEntry[]> {
	const pageMapItems: PageMapItem[] = await getPageMap(CASE_STUDIES_ROUTE);

	const entries: CaseStudyEntry[] = [];

	for (const item of pageMapItems) {
		// Skip MetaJsonFile entries (no `name` field, only `data`)
		if (!("name" in item)) {
			continue;
		}

		// Skip folder entries
		if ("children" in item) {
			continue;
		}

		// Now we have an MdxFile
		const file = item as MdxFile<CaseStudyFrontMatter>;

		// Exclude the index page and any underscore-prefixed names
		if (file.name === "index" || file.name.startsWith("_")) {
			continue;
		}

		const fm = file.frontMatter ?? {};
		const title = fm.title ?? file.name;
		const description = fm.description ?? "";
		const domain = fm.domain ?? "";
		const assurance_goal = fm.assurance_goal ?? "";

		// Only include entries that have the required domain/assurance_goal fields
		if (!(domain && assurance_goal)) {
			continue;
		}

		entries.push({
			slug: file.name,
			title,
			description,
			domain,
			assurance_goal,
			sidebar_position: fm.sidebar_position ?? 999,
			href: `${CASE_STUDIES_ROUTE}/${file.name}`,
		});
	}

	// Deterministic order: sidebar_position ascending, then title alphabetically
	entries.sort((a, b) => {
		if (a.sidebar_position !== b.sidebar_position) {
			return a.sidebar_position - b.sidebar_position;
		}
		return a.title.localeCompare(b.title);
	});

	return entries;
}

/**
 * CaseStudiesIndex — server component that renders the dynamic case-study
 * listing for the index page.
 *
 * Renders two sections:
 *   1. A summary table (Case Study | Domain | Assurance Goal)
 *   2. Per-domain grouped lists with title links and descriptions
 *
 * Adding a new case-study `.mdx` file with `domain` and `assurance_goal`
 * frontmatter makes it appear here automatically — no manual edit required.
 */
export async function CaseStudiesIndex() {
	const entries = await getCaseStudyEntries();

	// Build domain groups (preserving insertion order = sidebar_position order)
	const domainMap = new Map<string, CaseStudyEntry[]>();
	for (const entry of entries) {
		const existing = domainMap.get(entry.domain);
		if (existing) {
			existing.push(entry);
		} else {
			domainMap.set(entry.domain, [entry]);
		}
	}

	return (
		<>
			<h2>Available Case Studies</h2>

			<table>
				<thead>
					<tr>
						<th>Case Study</th>
						<th>Domain</th>
						<th>Assurance Goal</th>
					</tr>
				</thead>
				<tbody>
					{entries.map((entry) => (
						<tr key={entry.slug}>
							<td>
								<Link href={entry.href}>{entry.title}</Link>
							</td>
							<td>{entry.domain}</td>
							<td>{entry.assurance_goal}</td>
						</tr>
					))}
				</tbody>
			</table>

			{Array.from(domainMap.entries()).map(([domain, domainEntries]) => (
				<section key={domain}>
					<h3>{domain}</h3>
					<ul>
						{domainEntries.map((entry) => (
							<li key={entry.slug}>
								<strong>
									<Link href={entry.href}>{entry.title}</Link>
								</strong>{" "}
								- {entry.description}
							</li>
						))}
					</ul>
				</section>
			))}
		</>
	);
}

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
 *
 * getMDXComponents is dynamically imported so that the module boundary for
 * getCaseStudyEntries (used in unit tests) does not pull in the Nextra theme
 * bundle, which executes IntersectionObserver at module load time and is
 * unavailable in the Node test environment.
 */
export async function CaseStudiesIndex() {
	const entries = await getCaseStudyEntries();

	// Dynamic import keeps the Nextra theme bundle out of the getCaseStudyEntries
	// module graph, so unit tests can import that function without a browser env.
	// getMDXComponents is a plain function (not a hook) — safe to call in an RSC.
	const { getMDXComponents } = await import("@/mdx-components");
	const {
		a: A,
		h2: H2,
		h3: H3,
		table: Table,
		tr: Tr,
		th: Th,
		td: Td,
		ul: Ul,
		li: Li,
	} = getMDXComponents();

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
			<H2>Available Case Studies</H2>

			<Table>
				<thead>
					<Tr>
						<Th>Case Study</Th>
						<Th>Domain</Th>
						<Th>Assurance Goal</Th>
					</Tr>
				</thead>
				<tbody>
					{entries.map((entry) => (
						<Tr key={entry.slug}>
							<Td>
								<A href={entry.href}>{entry.title}</A>
							</Td>
							<Td>{entry.domain}</Td>
							<Td>{entry.assurance_goal}</Td>
						</Tr>
					))}
				</tbody>
			</Table>

			{Array.from(domainMap.entries()).map(([domain, domainEntries]) => (
				<section key={domain}>
					<H3>{domain}</H3>
					<Ul>
						{domainEntries.map((entry) => (
							<Li key={entry.slug}>
								<strong>
									<A href={entry.href}>{entry.title}</A>
								</strong>{" "}
								- {entry.description}
							</Li>
						))}
					</Ul>
				</section>
			))}
		</>
	);
}

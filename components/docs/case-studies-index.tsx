const CASE_STUDIES_ROUTE = "/docs/curriculum/case-studies";
const CASE_STUDIES_PREFIX = `${CASE_STUDIES_ROUTE}/`;

interface CaseStudyFrontMatter {
	assurance_goal?: string;
	description?: string;
	domain?: string;
	sidebar_position?: number;
	title: string;
}

interface CaseStudyPage {
	data: CaseStudyFrontMatter;
	url: string;
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
 * Extracts case-study entries from the Fumadocs page source for a given route.
 *
 * Takes `pages` as a plain array rather than reading the live doc source
 * itself, so unit tests can pass in fixture data directly — no module
 * mocking, and importantly no static import of `@/lib/docs-source` (which
 * pulls in the entire compiled content graph via the generated
 * `.source/server.ts` and needs the fumadocs-mdx build transform Vitest
 * doesn't have configured). `CaseStudiesIndex` below supplies the live
 * pages via a dynamic import at render time instead.
 *
 * Excluded: the index page itself and anything outside the case-studies
 * folder. Underscore-prefixed files (templates, workshop notes) never reach
 * here — `source.config.ts` excludes them from the doc collection entirely.
 */
export function getCaseStudyEntries(pages: CaseStudyPage[]): CaseStudyEntry[] {
	const entries: CaseStudyEntry[] = [];

	for (const page of pages) {
		// Only direct children of the case-studies folder — excludes the index
		// page itself (whose url has no trailing segment) and anything outside
		// this folder.
		if (!page.url.startsWith(CASE_STUDIES_PREFIX)) {
			continue;
		}
		const slug = page.url.slice(CASE_STUDIES_PREFIX.length);
		if (slug === "" || slug.includes("/")) {
			continue;
		}

		const { domain, assurance_goal, title, description, sidebar_position } =
			page.data;

		// Only include entries that have the required domain/assurance_goal fields
		if (!(domain && assurance_goal)) {
			continue;
		}

		entries.push({
			slug,
			title,
			description: description ?? "",
			domain,
			assurance_goal,
			sidebar_position: sidebar_position ?? 999,
			href: page.url,
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
 * Renders a single summary table (Case Study | Domain | Assurance Goal).
 * An earlier version also rendered a per-domain grouped list of the same
 * entries beneath it — removed (F9, readability review) because it just
 * repeated the table's links a second time on the page, on top of the
 * sidebar navigation's own listing of every case-study page.
 *
 * Adding a new case-study `.mdx` file with `domain` and `assurance_goal`
 * frontmatter makes it appear here automatically — no manual edit required.
 *
 * Plain HTML elements are used directly rather than pulled from the MDX
 * component map: `DocsBody` applies Fumadocs' `prose` typography class to
 * this subtree, so the table is styled without per-element overrides.
 *
 * `@/lib/docs-source` is dynamically imported here (not at module scope) to
 * keep `getCaseStudyEntries` unit-testable — see its doc comment.
 */
export async function CaseStudiesIndex() {
	const { source } = await import("@/lib/docs-source");
	const entries = getCaseStudyEntries(source.getPages());

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
								<a href={entry.href}>{entry.title}</a>
							</td>
							<td>{entry.domain}</td>
							<td>{entry.assurance_goal}</td>
						</tr>
					))}
				</tbody>
			</table>
		</>
	);
}

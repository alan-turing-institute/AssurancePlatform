import { CheckCircleIcon } from "@heroicons/react/20/solid";
import moment from "moment";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { fetchCaseStudies } from "@/actions/case-studies";
import PageHeading from "@/components/ui/page-heading";
import { Separator } from "@/components/ui/separator";
import { authOptions } from "@/lib/auth-options";
import { extractTextFromHtml } from "@/lib/sanitize-html";
import type { CaseStudy } from "@/types/domain";
import TableActions from "./_components/table-actions";

async function CaseStudiesPage() {
	const session = await getServerSession(authOptions);

	// Redirect user to login if no `key`
	if (!session?.key) {
		redirect("/login");
	}

	const caseStudies = await fetchCaseStudies(session.key);

	return (
		<div className="min-h-screen space-y-4 p-8">
			<PageHeading
				createButton
				description="Here you manage all your public patterns"
				redirect={true}
				redirectUrl="/dashboard/case-studies/create"
				title="Assurance Case Patterns"
			/>
			<Separator />

			<div className="">
				<div className="-mx-4 mt-8 sm:mx-0">
					<table className="min-w-full divide-y divide-foreground/10">
						<thead>
							<tr>
								<th
									className="py-3.5 pr-3 pl-4 text-left font-semibold text-foreground text-sm sm:pl-0"
									scope="col"
								>
									Title
								</th>
								<th
									className="hidden px-3 py-3.5 text-left font-semibold text-foreground text-sm lg:table-cell"
									scope="col"
								>
									Description
								</th>
								<th
									className="hidden px-3 py-3.5 text-left font-semibold text-foreground text-sm sm:table-cell"
									scope="col"
								>
									Authors
								</th>
								{/* <th
                  scope="col"
                  className="hidden px-3 py-3.5 text-left text-sm font-semibold text-foreground sm:table-cell"
                >
                  Sector
                </th> */}
								<th
									className="px-3 py-3.5 text-left font-semibold text-foreground text-sm"
									scope="col"
								>
									Created
								</th>
								<th
									className="px-3 py-3.5 text-left font-semibold text-foreground text-sm"
									scope="col"
								>
									Public
								</th>
								<th className="relative py-3.5 pr-4 pl-3 sm:pr-0" scope="col">
									<span className="sr-only">Edit</span>
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-foreground/10 bg-background">
							{caseStudies.length === 0 && (
								<tr>
									<td className="py-4 text-muted-foreground" colSpan={5}>
										No Case Studies Found.
									</td>
								</tr>
							)}
							{caseStudies.map((caseStudy: CaseStudy) => (
								<tr key={caseStudy.id}>
									<td className="w-full max-w-0 py-4 pr-3 pl-4 font-medium text-foreground text-sm sm:w-auto sm:max-w-none sm:pl-0">
										<Link
											className="group transition-all duration-200 hover:text-indigo-500"
											href={`case-studies/${caseStudy.id}`}
										>
											{caseStudy.title}
										</Link>
										<dl className="font-normal lg:hidden">
											<dt className="sr-only">Title</dt>
											<dd className="mt-1 max-w-[300px] truncate text-foreground/80">
												{extractTextFromHtml(caseStudy.description)}
											</dd>
											<dt className="sr-only sm:hidden">Published</dt>
											<dd className="mt-1 truncate text-gray-500 sm:hidden">
												{moment(caseStudy.publishedDate).format("DD/MM/YYYY")}
											</dd>
										</dl>
									</td>
									<td className="hidden max-w-[220px] px-3 py-4 text-foreground/80 text-sm lg:table-cell">
										<div className="line-clamp-3 overflow-hidden">
											<span>{extractTextFromHtml(caseStudy.description)}</span>
										</div>
									</td>
									<td className="hidden px-3 py-4 text-foreground/80 text-sm sm:table-cell">
										{caseStudy.authors}
									</td>
									{/* <td className="px-3 py-4 text-sm text-foreground/80">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-100/10 px-2 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-500 ring-1 ring-inset ring-indigo-700/10 dark:ring-indigo-500/20">
                      {caseStudy.sector}
                    </span>
                  </td> */}
									<td className="px-3 py-4 text-foreground/80 text-sm">
										{moment(caseStudy.createdOn).format("DD/MM/YYYY")}
									</td>
									<td className="px-3 py-4 text-foreground/80 text-sm">
										{caseStudy.published && (
											<CheckCircleIcon className="size-6 text-emerald-500" />
										)}
									</td>
									<td className="py-4 pr-4 pl-3 text-right font-medium text-sm sm:pr-0">
										{/* <a href="#" className="text-indigo-500 hover:text-indigo-600">
                      <Edit2Icon className='size-4' /><span className="sr-only">, {caseStudy.title}</span>
                    </a> */}
										<TableActions caseStudy={caseStudy} />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}

export default CaseStudiesPage;

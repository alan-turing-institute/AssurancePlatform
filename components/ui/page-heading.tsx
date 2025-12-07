import type { CaseStudy } from "@/types/domain";
import { Button } from "./button";
import PublishButton from "./publish-button";
import RedirectButton from "./redirect-button";

type PageHeadingProps = {
	title: string;
	description?: string;
	createButton?: boolean;
	button?: {
		label: string;
		published: boolean;
	};
	edit?: {
		action: () => void;
	};
	redirect?: boolean;
	redirectUrl?: string;
	caseStudy?: CaseStudy;
};

export default function PageHeading({
	title,
	description,
	createButton,
	button,
	edit,
	redirect,
	redirectUrl,
	caseStudy,
}: PageHeadingProps) {
	return (
		<div className="md:flex md:items-center md:justify-between">
			<div className="min-w-0 flex-1">
				<h2 className="font-bold text-foreground text-xl sm:truncate">
					{title}
				</h2>
				{description && (
					<p className="mt-2 text-muted-foreground text-sm">{description}</p>
				)}
			</div>
			<div className="mt-4 flex md:mt-0 md:ml-4">
				{edit && <Button variant={"ghost"}>Edit</Button>}
				{button && caseStudy && (
					<PublishButton
						caseStudy={caseStudy}
						label={button.label}
						published={button.published}
					/>
				)}
				{createButton && redirect && redirectUrl && (
					<RedirectButton label={"New Case Study"} url={redirectUrl} />
				)}
			</div>
		</div>
	);
}

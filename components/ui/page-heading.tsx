type PageHeadingProps = {
	title: string;
	description?: string;
};

export default function PageHeading({ title, description }: PageHeadingProps) {
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
		</div>
	);
}

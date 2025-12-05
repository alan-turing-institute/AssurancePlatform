import { FileTextIcon } from "lucide-react";

export const CardComponent = ({ title, description, url }) => (
	<a href={url} style={{ textDecoration: "none" }}>
		<div className="group rounded-lg bg-gray-100/50 p-6 transition-all duration-300 hover:cursor-pointer hover:bg-indigo-500 dark:bg-slate-900 dark:hover:bg-indigo-600">
			<div className="mb-2 flex items-center justify-start gap-2">
				<FileTextIcon className="size-5 transition-all duration-300 group-hover:text-white" />
				<div className="font-semibold text-xl transition-all duration-300 group-hover:text-white">
					{title}
				</div>
			</div>
			<div className="text-muted-foreground text-sm transition-all duration-300 group-hover:text-white">
				{description}
			</div>
		</div>
	</a>
);

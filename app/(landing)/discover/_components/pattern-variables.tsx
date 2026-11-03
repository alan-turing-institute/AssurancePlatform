import { patternVariables } from "@/lib/case/pattern-variables";

interface PatternVariablesProps {
	/** The published pattern's frozen snapshot. */
	content: unknown;
}

/**
 * The variables of a published pattern, listed on its Discover page: each with
 * its name and meaning, and a value only when the pattern gives it one. The
 * list is read from the public snapshot, so it is shown whether or not the
 * visitor is signed in. A pattern without variables shows nothing.
 */
const PatternVariables = ({ content }: PatternVariablesProps) => {
	const variables = patternVariables(content);
	if (variables.length === 0) {
		return null;
	}

	return (
		<div className="pt-6">
			<h3 className="font-semibold text-foreground text-lg">Variables</h3>
			<p className="mt-2 text-sm">
				Using this pattern asks you for a value for each of these. A variable
				you leave empty shows as its name in square brackets until you set it.
			</p>
			<dl className="mt-3 space-y-3 text-sm">
				{variables.map((variable) => (
					<div key={variable.id}>
						<dt className="font-medium text-foreground">{variable.name}</dt>
						{variable.meaning && (
							<dd className="wrap-anywhere whitespace-pre-line">
								{variable.meaning}
							</dd>
						)}
						{variable.value && (
							<dd className="wrap-anywhere">
								Default value:{" "}
								<span className="text-foreground">{variable.value}</span>
							</dd>
						)}
					</div>
				))}
			</dl>
		</div>
	);
};

export default PatternVariables;

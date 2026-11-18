interface ShareMessagesProps {
	error: string | null;
	notice: string | null;
}

export function ShareMessages({ error, notice }: ShareMessagesProps) {
	return (
		<>
			{error && (
				<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
					{error}
				</div>
			)}

			{notice && (
				<output className="block rounded-md bg-muted p-3 text-muted-foreground text-sm">
					{notice}
				</output>
			)}
		</>
	);
}

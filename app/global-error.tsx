"use client";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	console.error("Global error:", error);

	return (
		<html lang="en">
			<head>
				<style>
					{
						"body{margin:0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background-color:#fafafa;color:#171717}.ge-t{color:#737373}.ge-b{margin-top:1.5rem;padding:.5rem 1rem;border-radius:.375rem;border:1px solid #d4d4d4;background-color:#fff;cursor:pointer;font-size:.875rem;color:inherit}@media(prefers-color-scheme:dark){body{background-color:#0a0a0a;color:#fafafa}.ge-t{color:#a3a3a3}.ge-b{background-color:#171717;border-color:#404040}}"
					}
				</style>
			</head>
			<body>
				<div style={{ textAlign: "center", padding: "2rem" }}>
					<h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
						Something went wrong
					</h2>
					<p className="ge-t" style={{ marginTop: "0.5rem" }}>
						An unexpected error occurred. Please try again.
					</p>
					<button className="ge-b" onClick={reset} type="button">
						Try again
					</button>
					<a
						className="ge-b"
						href="/"
						style={{
							display: "inline-block",
							marginLeft: "0.5rem",
							textDecoration: "none",
						}}
					>
						Go to homepage
					</a>
				</div>
			</body>
		</html>
	);
}

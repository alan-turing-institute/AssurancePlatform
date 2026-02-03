"use client";

export default function GlobalError({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<html lang="en">
			<body
				style={{
					margin: 0,
					fontFamily: "system-ui, sans-serif",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					minHeight: "100vh",
					backgroundColor: "#fafafa",
					color: "#171717",
				}}
			>
				<div style={{ textAlign: "center", padding: "2rem" }}>
					<h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
						Something went wrong
					</h2>
					<p style={{ marginTop: "0.5rem", color: "#737373" }}>
						An unexpected error occurred. Please try again.
					</p>
					<button
						onClick={reset}
						style={{
							marginTop: "1.5rem",
							padding: "0.5rem 1rem",
							borderRadius: "0.375rem",
							border: "1px solid #d4d4d4",
							backgroundColor: "#fff",
							cursor: "pointer",
							fontSize: "0.875rem",
						}}
						type="button"
					>
						Try again
					</button>
				</div>
			</body>
		</html>
	);
}

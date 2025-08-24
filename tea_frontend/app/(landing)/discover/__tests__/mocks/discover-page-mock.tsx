import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import type { AssuranceCase } from "@/types/domain";

export const DiscoverPageMock = () => {
	const router = useRouter();
	const [cases, setCases] = useState<AssuranceCase[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [sortBy, setSortBy] = useState("published_date_desc");
	const [retryCount, setRetryCount] = useState(0);

	useEffect(() => {
		const buildQueryParams = () => {
			const params = new URLSearchParams();
			if (searchQuery) {
				params.append("search", searchQuery);
			}
			if (selectedTags.length > 0) {
				params.append("tags", selectedTags.join(","));
			}
			if (sortBy) {
				params.append("sort", sortBy);
			}
			return params;
		};

		const fetchCases = async () => {
			try {
				setLoading(true);
				setError(null); // Clear any previous errors when fetching
				const params = buildQueryParams();
				const apiUrl =
					process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
				// Include retryCount in URL to force refetch on retry
				const url = `${apiUrl}/api/public/published-cases/?${params.toString()}${retryCount > 0 ? `&retry=${retryCount}` : ""}`;
				const response = await fetch(url);

				if (!response.ok) {
					throw new Error("Unable to load published cases");
				}

				const data = await response.json();
				setCases(data);
			} catch (err) {
				setError((err as Error).message);
			} finally {
				setLoading(false);
			}
		};

		fetchCases();
	}, [searchQuery, selectedTags, sortBy, retryCount]);

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		const formData = new FormData(e.target as HTMLFormElement);
		setSearchQuery(formData.get("search") as string);
	};

	const handleApplyFilters = () => {
		// Filters are already applied via useEffect
	};

	const handleRetry = () => {
		setError(null);
		// Trigger re-fetch by updating retry count
		setRetryCount((prev) => prev + 1);
	};

	if (loading) {
		return <div>Loading...</div>;
	}

	if (error) {
		return (
			<div>
				<p>{error}</p>
				<button onClick={handleRetry} type="button">
					Retry
				</button>
			</div>
		);
	}

	return (
		<div>
			<h1>Community Case Studies</h1>

			<form onSubmit={handleSearch}>
				<input
					defaultValue={searchQuery}
					name="search"
					placeholder="Search cases"
					type="text"
				/>
				<button type="submit">Search</button>
			</form>

			<div>
				<select
					aria-label="Filter by tags"
					onChange={(e) => {
						if (e.target.value) {
							setSelectedTags([e.target.value]);
						} else {
							setSelectedTags([]);
						}
					}}
				>
					<option value="">All Tags</option>
					<option value="safety">Safety</option>
					<option value="automotive">Automotive</option>
					<option value="medical">Medical</option>
					<option value="aerospace">Aerospace</option>
					<option value="critical">Critical</option>
				</select>
				<button onClick={handleApplyFilters} type="button">
					Apply Filters
				</button>
			</div>

			<select
				aria-label="Sort by"
				onChange={(e) => setSortBy(e.target.value)}
				value={sortBy}
			>
				<option value="published_date_desc">Newest First</option>
				<option value="published_date_asc">Oldest First</option>
				<option value="name">Name</option>
			</select>

			<div>
				{cases.map((caseItem) => (
					<div data-testid="case-card" key={caseItem.id}>
						<button
							onClick={() => {
								router.push(`/discover/cases/${caseItem.id}`);
							}}
							style={{
								cursor: "pointer",
								background: "none",
								border: "none",
								padding: 0,
								font: "inherit",
								textAlign: "left",
								width: "100%",
								fontSize: "1.5em",
								fontWeight: "bold",
								marginBottom: "0.5em",
							}}
							type="button"
						>
							{caseItem.name}
						</button>
						<p>{caseItem.description}</p>
					</div>
				))}
			</div>
		</div>
	);
};

"use client";
import { lazy, Suspense, useEffect, useState } from "react";
import type { Node } from "reactflow";
import type { CaseData, ReactFlowNodeData } from "@/types/curriculum";
import InteractiveCaseViewer from "./interactive-case-viewer";

// Lazy load EnhancedInteractiveCaseViewer to avoid 730+ module import at startup
const EnhancedInteractiveCaseViewer = lazy(
	() => import("./enhanced-interactive-case-viewer")
);

type CaseViewerWrapperProps = {
	caseFile?: string;
	showAllNodes?: boolean;
	enableExploration?: boolean;
	onNodeClick?: ((node: Node<ReactFlowNodeData>) => void) | null;
	guidedPath?: string[];
	highlightedNodes?: string[];
	useEnhanced?: boolean;
};

/**
 * Wrapper component that loads case data from static folder and renders InteractiveCaseViewer
 * Loads JSON data from /public/data/ folder
 */
const CaseViewerWrapper = ({
	caseFile = "fair-recruitment-ai.json",
	showAllNodes = false,
	enableExploration = true,
	onNodeClick = null,
	guidedPath = [],
	highlightedNodes = [],
	useEnhanced = false,
}: CaseViewerWrapperProps) => {
	const [caseData, setCaseData] = useState<CaseData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const loadCaseData = async () => {
			try {
				const response = await fetch(`/data/${caseFile}`);
				if (!response.ok) {
					throw new Error(`Failed to load case data: ${response.statusText}`);
				}
				const data = (await response.json()) as CaseData;
				setCaseData(data);
				setError(null);
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "Unknown error occurred";
				console.error(`Error loading case file '${caseFile}':`, err);
				setError(errorMessage);
			} finally {
				setIsLoading(false);
			}
		};

		loadCaseData();
	}, [caseFile]);

	if (isLoading) {
		return (
			<div className="flex h-96 w-full items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
				<div className="text-center">
					<div className="mb-4 inline-block">
						<div className="h-12 w-12 animate-spin rounded-full border-blue-500 border-b-2" />
					</div>
					<p className="text-gray-600 dark:text-gray-400">
						Loading assurance case...
					</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="w-full rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
				<h3 className="mb-2 font-bold text-red-700 dark:text-red-400">
					Error Loading Case Data
				</h3>
				<p className="text-red-600 text-sm dark:text-red-300">{error}</p>
				<p className="mt-2 text-red-500 text-xs dark:text-red-400">
					Tried to load: /data/{caseFile}
				</p>
			</div>
		);
	}

	if (!caseData) {
		return (
			<div className="w-full rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
				<h3 className="font-bold text-yellow-700 dark:text-yellow-400">
					No Data Available
				</h3>
				<p className="text-sm text-yellow-600 dark:text-yellow-300">
					No case data was loaded.
				</p>
			</div>
		);
	}

	const viewerProps = {
		caseData,
		showAllNodes,
		enableExploration,
		onNodeClick: onNodeClick || undefined,
		guidedPath,
		highlightedNodes,
	};

	if (useEnhanced) {
		return (
			<Suspense
				fallback={
					<div className="flex h-96 w-full items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
						<div className="text-center">
							<div className="mb-4 inline-block">
								<div className="h-12 w-12 animate-spin rounded-full border-blue-500 border-b-2" />
							</div>
							<p className="text-gray-600 dark:text-gray-400">
								Loading enhanced viewer...
							</p>
						</div>
					</div>
				}
			>
				<EnhancedInteractiveCaseViewer {...viewerProps} />
			</Suspense>
		);
	}

	return <InteractiveCaseViewer {...viewerProps} />;
};

export default CaseViewerWrapper;

"use client";
/**
 * Full Integration Demo
 *
 * Comprehensive demonstration of EnhancedInteractiveCaseViewer
 * with all features working together.
 *
 * @component
 */

import { useMemo, useState } from "react";
import type { FeatureConfig } from "../config/feature-config";
import { getFeatureConfig } from "../config/feature-config";

type CaseElement = {
	name: string;
	short_description?: string;
	description?: string;
	long_description?: string;
	evidence?: CaseElement[];
};

type PropertyClaim = CaseElement & {
	evidence?: CaseElement[];
};

type Strategy = CaseElement & {
	property_claims?: PropertyClaim[];
};

type Goal = CaseElement & {
	strategies?: Strategy[];
	context?: CaseElement[];
};

type CaseData = {
	goals: Goal[];
};

const sampleCaseData: CaseData = {
	goals: [
		{
			name: "Autonomous Vehicle Safety",
			short_description: "AV system operates safely in all conditions",
			description:
				"The autonomous vehicle system shall operate safely under all operating conditions.",
			strategies: [
				{
					name: "Hazard-Based Decomposition",
					short_description: "Decompose by hazard analysis",
					description: "Decompose safety argument by hazard analysis",
					property_claims: [
						{
							name: "Perception Hazards Mitigated",
							short_description: "All perception hazards addressed",
							description: "All perception hazards are mitigated",
							evidence: [
								{
									name: "FMEA Analysis",
									short_description: "Failure modes analysis complete",
									description: "FMEA analysis completed",
								},
							],
						},
					],
				},
			],
			context: [
				{
					name: "Operational Design Domain",
					short_description: "Urban roads, daylight, dry conditions",
					description: "Urban roads, daylight, dry conditions",
				},
			],
		},
	],
};

type FeatureTogglePanelProps = {
	features: FeatureConfig;
	onChange: (features: FeatureConfig) => void;
};

const FeatureTogglePanel = ({
	features,
	onChange,
}: FeatureTogglePanelProps) => {
	const toggleFeature = (feature: keyof FeatureConfig) => {
		onChange({ ...features, [feature]: !features[feature] });
	};

	return (
		<div className="space-y-3 rounded-lg bg-gray-800 p-4">
			<h3 className="mb-2 font-semibold text-gray-100 text-lg">
				Feature Toggles
			</h3>

			<div className="grid grid-cols-2 gap-2">
				<label className="flex cursor-pointer items-center gap-2 text-gray-300 text-sm">
					<input
						checked={features.enableCollapsible}
						className="rounded"
						onChange={() => toggleFeature("enableCollapsible")}
						type="checkbox"
					/>
					Collapsible Nodes
				</label>

				<label className="flex cursor-pointer items-center gap-2 text-gray-300 text-sm">
					<input
						checked={features.enableContextMenus}
						className="rounded"
						onChange={() => toggleFeature("enableContextMenus")}
						type="checkbox"
					/>
					Context Menus
				</label>

				<label className="flex cursor-pointer items-center gap-2 text-gray-300 text-sm">
					<input
						checked={features.enableNodeCreation}
						className="rounded"
						onChange={() => toggleFeature("enableNodeCreation")}
						type="checkbox"
					/>
					Node Creation
				</label>

				<label className="flex cursor-pointer items-center gap-2 text-gray-300 text-sm">
					<input
						checked={features.enableAnimations}
						className="rounded"
						onChange={() => toggleFeature("enableAnimations")}
						type="checkbox"
					/>
					Animations
				</label>
			</div>
		</div>
	);
};

type StatsDisplayProps = {
	caseData: CaseData;
};

const StatsDisplay = ({ caseData }: StatsDisplayProps) => {
	const stats = useMemo(() => {
		if (!caseData?.goals?.[0]) {
			return { goals: 0, strategies: 0, claims: 0 };
		}

		const goal = caseData.goals[0];
		const contextCount = goal.context?.length || 0;

		if (!goal.strategies) {
			return {
				goals: 1,
				strategies: 0,
				claims: 0,
				evidence: 0,
				context: contextCount,
			};
		}

		const strategyCount = goal.strategies.length;
		let claimCount = 0;
		let evidenceCount = 0;

		for (const strategy of goal.strategies) {
			const claims = strategy.property_claims || [];
			claimCount += claims.length;

			for (const claim of claims) {
				evidenceCount += claim.evidence?.length || 0;
			}
		}

		return {
			goals: 1,
			strategies: strategyCount,
			claims: claimCount,
			evidence: evidenceCount,
			context: contextCount,
			total: 1 + strategyCount + claimCount + evidenceCount + contextCount,
		};
	}, [caseData]);

	return (
		<div className="rounded-lg bg-gray-800 p-4">
			<h3 className="mb-2 font-semibold text-gray-100 text-lg">
				Graph Statistics
			</h3>
			<div className="grid grid-cols-3 gap-4 text-center">
				<div>
					<div className="font-bold text-2xl text-green-400">{stats.goals}</div>
					<div className="text-gray-400 text-xs">Goals</div>
				</div>
				<div>
					<div className="font-bold text-2xl text-purple-400">
						{stats.strategies}
					</div>
					<div className="text-gray-400 text-xs">Strategies</div>
				</div>
				<div>
					<div className="font-bold text-2xl text-orange-400">
						{stats.claims}
					</div>
					<div className="text-gray-400 text-xs">Claims</div>
				</div>
			</div>
		</div>
	);
};

const FullIntegrationDemo = () => {
	const [features, setFeatures] = useState(getFeatureConfig("full"));
	const [caseData] = useState(sampleCaseData);

	return (
		<div className="min-h-screen w-full space-y-6 bg-gray-950 p-8">
			<div className="mb-8 text-center">
				<h1 className="mb-2 font-bold text-4xl text-gray-100">
					Enhanced Interactive Case Viewer
				</h1>
				<p className="text-gray-400 text-lg">
					Full Integration Demo - All Features Working Together
				</p>
			</div>

			<div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
				<div className="lg:col-span-2">
					<FeatureTogglePanel features={features} onChange={setFeatures} />
				</div>
				<div>
					<StatsDisplay caseData={caseData} />
				</div>
			</div>

			<div className="rounded-lg bg-gray-800 p-6">
				<p className="text-gray-300">
					This is a placeholder for the full integration demo. The actual
					implementation requires additional components that are being
					developed.
				</p>
			</div>
		</div>
	);
};

export default FullIntegrationDemo;

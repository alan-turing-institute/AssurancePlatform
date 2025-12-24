"use client";

/**
 * Block Form Component
 *
 * Dynamic form component that adapts based on node type.
 * Provides type-specific fields with validation and smart defaults.
 *
 * Features:
 * - Common fields: Name, Description
 * - Type-specific fields based on node type
 * - Form validation with error display
 * - Auto-save draft support
 * - Quick mode for minimal fields
 * - Character count for text areas
 * - Tag inputs for metadata
 * - Date pickers for deadlines
 * - Sliders for numeric values
 *
 * @component
 */

import { motion } from "framer-motion";
import { AlertCircle, Calendar } from "lucide-react";
import React, {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ValidationErrors = Record<string, string>;

type FormFieldProps = {
	label: string;
	error?: string;
	required?: boolean;
	children: React.ReactNode;
	helperText?: string;
};

/**
 * Form Field Wrapper
 */
const FormField = ({
	label,
	error,
	required,
	children,
	helperText,
}: FormFieldProps) => (
	<div className="space-y-2">
		<Label className="font-medium text-sm text-text-light">
			{label}
			{required && <span className="ml-1 text-red-400">*</span>}
		</Label>
		{children}
		{helperText && !error && (
			<p className="text-text-light/50 text-xs">{helperText}</p>
		)}
		{error && (
			<motion.div
				animate={{ opacity: 1, y: 0 }}
				className="flex items-center gap-2 text-red-400 text-xs"
				initial={{ opacity: 0, y: -10 }}
			>
				<AlertCircle className="h-3 w-3" />
				{error}
			</motion.div>
		)}
	</div>
);

type CharacterCounterProps = {
	current: number;
	max: number;
	className?: string;
};

/**
 * Character Counter Component
 */
const CharacterCounter = ({
	current,
	max,
	className,
}: CharacterCounterProps) => {
	const percentage = (current / max) * 100;
	const isNearLimit = percentage > 80;
	const isOverLimit = current > max;

	const getColorClass = () => {
		if (isOverLimit) {
			return "text-red-400";
		}
		if (isNearLimit) {
			return "text-yellow-400";
		}
		return "text-text-light/50";
	};
	const colorClass = getColorClass();

	return (
		<div className={cn("text-xs", className)}>
			<span className={cn(colorClass)}>
				{current} / {max}
			</span>
		</div>
	);
};

type TagInputProps = {
	value?: string[];
	onChange: (tags: string[]) => void;
	placeholder?: string;
	maxTags?: number;
};

/**
 * Tag Input Component
 */
const TagInput = ({
	value = [],
	onChange,
	placeholder,
	maxTags = 10,
}: TagInputProps) => {
	const [inputValue, setInputValue] = React.useState("");

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			const newTag = inputValue.trim();
			if (newTag && !value.includes(newTag) && value.length < maxTags) {
				onChange([...value, newTag]);
				setInputValue("");
			}
		} else if (e.key === "Backspace" && !inputValue && value.length > 0) {
			onChange(value.slice(0, -1));
		}
	};

	const removeTag = (tagToRemove: string) => {
		onChange(value.filter((tag) => tag !== tagToRemove));
	};

	return (
		<div className="space-y-2">
			<div className="flex flex-wrap gap-1.5">
				{value.map((tag) => (
					<Badge
						className="bg-background-transparent-white-hover text-text-light"
						key={tag}
						variant="secondary"
					>
						{tag}
						<button
							className="ml-1.5 hover:text-red-400"
							onClick={() => removeTag(tag)}
							type="button"
						>
							×
						</button>
					</Badge>
				))}
			</div>
			<Input
				className={cn(
					"bg-background-transparent-white-hover",
					"border-transparent",
					"text-text-light",
					"placeholder:text-text-light/50"
				)}
				onChange={(e) => setInputValue(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				value={inputValue}
			/>
			<p className="text-text-light/50 text-xs">
				Press Enter or comma to add tags
			</p>
		</div>
	);
};

type FormData = Record<string, unknown>;

type BlockFormProps = {
	nodeType: string;
	formData?: FormData;
	onChange: (data: FormData) => void;
	quickMode?: boolean;
	validationErrors?: ValidationErrors;
};

type BlockFormHandle = {
	validate: () => ValidationErrors;
	getData: () => FormData;
};

/**
 * BlockForm Component
 */
const BlockForm = forwardRef<BlockFormHandle, BlockFormProps>(
	(
		{
			nodeType,
			formData = {},
			onChange,
			quickMode = false,
			validationErrors = {},
		},
		ref
	) => {
		// Expose validation method to parent
		useImperativeHandle(ref, () => ({
			validate: () => {
				const errors: ValidationErrors = {};
				if (!formData.name || String(formData.name).trim() === "") {
					errors.name = "Name is required";
				}
				if (
					!quickMode &&
					(!formData.description || String(formData.description).trim() === "")
				) {
					errors.description = "Description is required";
				}
				return errors;
			},
			getData: () => formData,
		}));

		// Handle field change
		const handleChange = useCallback(
			(field: string, value: unknown) => {
				onChange({ ...formData, [field]: value });
			},
			[formData, onChange]
		);

		// Set default values based on node type
		useEffect(() => {
			if (Object.keys(formData).length === 0) {
				const defaults = getDefaultFormData(nodeType);
				onChange(defaults);
			}
		}, [nodeType, formData, onChange]);

		// Common fields for all node types
		const renderCommonFields = () => (
			<>
				{/* Name */}
				<FormField
					error={validationErrors.name}
					helperText="A clear, concise name for this node"
					label="Name"
					required
				>
					<Input
						className={cn(
							"bg-background-transparent-white-hover",
							"border-transparent",
							"text-text-light",
							"placeholder:text-text-light/50"
						)}
						maxLength={100}
						onChange={(e) => handleChange("name", e.target.value)}
						placeholder="Enter node name..."
						value={String(formData.name || "")}
					/>
					<CharacterCounter
						current={String(formData.name || "").length}
						max={100}
					/>
				</FormField>

				{/* Description */}
				{!quickMode && (
					<FormField
						error={validationErrors.description}
						helperText="Detailed description of this node's purpose"
						label="Description"
						required
					>
						<Textarea
							className={cn(
								"bg-background-transparent-white-hover",
								"border-transparent",
								"text-text-light",
								"placeholder:text-text-light/50",
								"resize-none"
							)}
							maxLength={500}
							onChange={(e) => handleChange("description", e.target.value)}
							placeholder="Enter description..."
							rows={4}
							value={String(formData.description || "")}
						/>
						<CharacterCounter
							current={String(formData.description || "").length}
							max={500}
						/>
					</FormField>
				)}
			</>
		);

		// Goal-specific fields
		const renderGoalFields = () => (
			<>
				{!quickMode && (
					<>
						<FormField
							helperText="Importance level of this goal"
							label="Priority"
						>
							<Select
								onValueChange={(value) => handleChange("priority", value)}
								value={String(formData.priority || "medium")}
							>
								<SelectTrigger className="border-transparent bg-background-transparent-white-hover text-text-light">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="critical">Critical</SelectItem>
									<SelectItem value="high">High</SelectItem>
									<SelectItem value="medium">Medium</SelectItem>
									<SelectItem value="low">Low</SelectItem>
								</SelectContent>
							</Select>
						</FormField>

						<FormField
							helperText="When this goal should be achieved"
							label="Target Date"
						>
							<div className="relative">
								<Calendar className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-text-light/50" />
								<Input
									className={cn(
										"pl-10",
										"bg-background-transparent-white-hover",
										"border-transparent",
										"text-text-light"
									)}
									onChange={(e) => handleChange("targetDate", e.target.value)}
									type="date"
									value={String(formData.targetDate || "")}
								/>
							</div>
						</FormField>

						<FormField
							helperText="How will you measure success?"
							label="Success Criteria"
						>
							<Textarea
								className={cn(
									"bg-background-transparent-white-hover",
									"border-transparent",
									"text-text-light",
									"placeholder:text-text-light/50",
									"resize-none"
								)}
								maxLength={300}
								onChange={(e) =>
									handleChange("successCriteria", e.target.value)
								}
								placeholder="Define success criteria..."
								rows={3}
								value={String(formData.successCriteria || "")}
							/>
							<CharacterCounter
								current={String(formData.successCriteria || "").length}
								max={300}
							/>
						</FormField>
					</>
				)}
			</>
		);

		// Strategy-specific fields
		const renderStrategyFields = () => (
			<>
				{!quickMode && (
					<>
						<FormField
							helperText="How this strategy decomposes the parent goal"
							label="Strategy Type"
						>
							<Select
								onValueChange={(value) => handleChange("strategyType", value)}
								value={String(formData.strategyType || "AND")}
							>
								<SelectTrigger className="border-transparent bg-background-transparent-white-hover text-text-light">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="AND">
										AND (All sub-goals required)
									</SelectItem>
									<SelectItem value="OR">
										OR (Any sub-goal sufficient)
									</SelectItem>
								</SelectContent>
							</Select>
						</FormField>

						<FormField
							helperText="The decomposition approach being used"
							label="Approach"
						>
							<Input
								className={cn(
									"bg-background-transparent-white-hover",
									"border-transparent",
									"text-text-light",
									"placeholder:text-text-light/50"
								)}
								onChange={(e) => handleChange("approach", e.target.value)}
								placeholder="e.g., 'By system component', 'By hazard type'..."
								value={String(formData.approach || "")}
							/>
						</FormField>

						<FormField
							helperText="Why this strategy was chosen"
							label="Rationale"
						>
							<Textarea
								className={cn(
									"bg-background-transparent-white-hover",
									"border-transparent",
									"text-text-light",
									"placeholder:text-text-light/50",
									"resize-none"
								)}
								maxLength={300}
								onChange={(e) => handleChange("rationale", e.target.value)}
								placeholder="Explain the reasoning..."
								rows={3}
								value={String(formData.rationale || "")}
							/>
							<CharacterCounter
								current={String(formData.rationale || "").length}
								max={300}
							/>
						</FormField>
					</>
				)}
			</>
		);

		// Property Claim-specific fields
		const renderPropertyClaimFields = () => (
			<>
				{!quickMode && (
					<>
						<FormField
							helperText="The specific claim being made"
							label="Claim Text"
						>
							<Textarea
								className={cn(
									"bg-background-transparent-white-hover",
									"border-transparent",
									"text-text-light",
									"placeholder:text-text-light/50",
									"resize-none"
								)}
								maxLength={400}
								onChange={(e) => handleChange("claimText", e.target.value)}
								placeholder="State the claim clearly..."
								rows={3}
								value={String(formData.claimText || "")}
							/>
							<CharacterCounter
								current={String(formData.claimText || "").length}
								max={400}
							/>
						</FormField>

						<FormField helperText="How strong is this claim?" label="Strength">
							<div className="space-y-2">
								<Slider
									className="py-4"
									max={100}
									onValueChange={(value) => handleChange("strength", value[0])}
									step={10}
									value={[Number(formData.strength) || 50]}
								/>
								<div className="flex justify-between text-text-light/50 text-xs">
									<span>Weak</span>
									<span className="font-medium text-text-light">
										{Number(formData.strength) || 50}%
									</span>
									<span>Strong</span>
								</div>
							</div>
						</FormField>

						<FormField
							helperText="How will this claim be verified?"
							label="Verification Method"
						>
							<Select
								onValueChange={(value) =>
									handleChange("verificationMethod", value)
								}
								value={String(formData.verificationMethod || "testing")}
							>
								<SelectTrigger className="border-transparent bg-background-transparent-white-hover text-text-light">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="testing">Testing</SelectItem>
									<SelectItem value="analysis">Analysis</SelectItem>
									<SelectItem value="inspection">Inspection</SelectItem>
									<SelectItem value="demonstration">Demonstration</SelectItem>
									<SelectItem value="review">Review</SelectItem>
								</SelectContent>
							</Select>
						</FormField>
					</>
				)}
			</>
		);

		// Evidence-specific fields
		const renderEvidenceFields = () => (
			<>
				{!quickMode && (
					<>
						<FormField
							helperText="Where this evidence comes from"
							label="Evidence Source"
						>
							<Input
								className={cn(
									"bg-background-transparent-white-hover",
									"border-transparent",
									"text-text-light",
									"placeholder:text-text-light/50"
								)}
								onChange={(e) => handleChange("source", e.target.value)}
								placeholder="e.g., 'Test Report TR-2024-001'..."
								value={String(formData.source || "")}
							/>
						</FormField>

						<FormField
							helperText="How confident are you in this evidence?"
							label="Confidence Level"
						>
							<div className="space-y-2">
								<Slider
									className="py-4"
									max={100}
									onValueChange={(value) =>
										handleChange("confidence", value[0])
									}
									step={5}
									value={[Number(formData.confidence) || 75]}
								/>
								<div className="flex justify-between text-text-light/50 text-xs">
									<span>Low</span>
									<span className="font-medium text-text-light">
										{Number(formData.confidence) || 75}%
									</span>
									<span>High</span>
								</div>
							</div>
						</FormField>

						<FormField
							helperText="Link to evidence document or artifact"
							label="Link/URL"
						>
							<Input
								className={cn(
									"bg-background-transparent-white-hover",
									"border-transparent",
									"text-text-light",
									"placeholder:text-text-light/50"
								)}
								onChange={(e) => handleChange("link", e.target.value)}
								placeholder="https://..."
								type="url"
								value={String(formData.link || "")}
							/>
						</FormField>

						<FormField
							helperText="Add tags to categorise this evidence"
							label="Tags"
						>
							<TagInput
								onChange={(tags) => handleChange("tags", tags)}
								placeholder="Add tags..."
								value={(formData.tags as string[]) || []}
							/>
						</FormField>
					</>
				)}
			</>
		);

		return (
			<div className="space-y-4">
				{renderCommonFields()}

				{/* Type-specific fields */}
				{nodeType === "goal" && renderGoalFields()}
				{nodeType === "strategy" && renderStrategyFields()}
				{nodeType === "propertyClaim" && renderPropertyClaimFields()}
				{nodeType === "evidence" && renderEvidenceFields()}
			</div>
		);
	}
);

BlockForm.displayName = "BlockForm";

/**
 * Get default form data for node type
 */
const getDefaultFormData = (nodeType: string): FormData => {
	const defaults: Record<string, FormData> = {
		goal: {
			name: "",
			description: "",
			priority: "medium",
			targetDate: "",
			successCriteria: "",
		},
		strategy: {
			name: "",
			description: "",
			strategyType: "AND",
			approach: "",
			rationale: "",
		},
		propertyClaim: {
			name: "",
			description: "",
			claimText: "",
			strength: 50,
			verificationMethod: "testing",
		},
		evidence: {
			name: "",
			description: "",
			source: "",
			confidence: 75,
			link: "",
			tags: [],
		},
	};

	return defaults[nodeType] || defaults.goal;
};

export default BlockForm;

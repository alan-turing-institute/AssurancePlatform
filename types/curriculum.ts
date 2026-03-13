/**
 * Shared type definitions for curriculum/documentation components.
 * These types are used across the interactive learning components
 * including quizzes, concept displays, progress tracking, and React Flow viewers.
 */

// ============================================
// Assurance Case Element Types
// ============================================

/**
 * Node types for React Flow visualisation in curriculum components.
 * Uses full element names (e.g. "propertyClaim") matching the export schema.
 *
 * Note on Context: The Prisma schema supports CONTEXT as an ElementType, but in
 * the current design context is stored as a string[] attribute on nodes
 * (see TreeNode.context), not as a separate node type.
 */
export type CurriculumNodeType =
	| "goal"
	| "strategy"
	| "propertyClaim"
	| "evidence";

export type TaskStatus = "pending" | "in_progress" | "completed" | "skipped";

export type ImportanceLevel = "critical" | "medium" | "low";

export type QualityLevel = "high" | "medium" | "low";

// ============================================
// New Export Schema Types (v1.0)
// ============================================

/**
 * Element types, roles, and module embed types — re-exported from Prisma as single source of truth.
 */
export type {
	ElementRole,
	ElementType,
	ModuleEmbedType,
} from "@/src/generated/prisma";

import type {
	ElementRole,
	ElementType,
	ModuleEmbedType,
} from "@/src/generated/prisma";

/**
 * Comment attached to an element in the export.
 */
export interface ExportComment {
	author: string;
	content: string;
	createdAt: string;
}

/**
 * Recursive tree node structure for the nested export format.
 * Each node can contain children of various types.
 *
 * The `name` field contains the identifier (G1, P1.1, etc.) stored in DB.
 * The optional `title` field can contain a human-readable display name.
 */
export interface TreeNode {
	assumption?: string | null;
	children: TreeNode[];
	// Comments (optional)
	comments?: ExportComment[];
	context?: string[];
	defeatsElementId?: string;
	description: string;
	// Pattern metadata
	fromPattern?: boolean;
	id: string;
	inSandbox: boolean;
	// Dialogical reasoning
	isDefeater?: boolean;
	justification?: string | null;
	level?: number | null;
	modifiedFromPattern?: boolean;
	moduleEmbedType?: ModuleEmbedType;
	modulePublicSummary?: string | null;
	// Module fields
	moduleReferenceId?: string;
	name: string | null;
	// Type-specific fields (only present when applicable)
	role?: ElementRole | null;
	// Optional display title (for future use)
	title?: string | null;
	type: ElementType;
	url?: string | null;
}

/**
 * Case metadata in the nested export format.
 */
export interface CaseMetadata {
	description: string;
	name: string;
}

/**
 * New nested export format (v1.0).
 * This is the primary format exported by the TEA Platform.
 */
export interface CaseExportNested {
	case: CaseMetadata;
	exportedAt: string;
	tree: TreeNode;
	version: "1.0";
}

// ============================================
// Progress Tracking Types
// ============================================

/**
 * Represents a single task in the progress tracking system.
 */
export interface Task {
	completed?: boolean;
	completedAt?: string | null;
	id: string;
	page?: string;
	required?: boolean;
	status: TaskStatus;
}

/**
 * Complete progress data for a module, including tasks and computed progress.
 */
export interface ProgressData {
	courseId?: string;
	currentPage?: string;
	lastUpdated?: string;
	moduleId?: string;
	progress: {
		completed: number;
		total: number;
		percentage: number;
	};
	tasks: Task[];
}

/**
 * Context value provided by ModuleProgressContext.
 */
export interface ModuleProgressContextValue {
	completeTask: (taskId: string) => void;
	getCurrentPageTasks: () => Task[];
	getTask: (taskId: string) => Task | undefined;
	isLoaded: boolean;
	progress: ProgressData["progress"];
	resetProgress: () => void;
	resetTask: (taskId: string) => void;
	skipTask: (taskId: string) => void;
	startTask: (taskId: string) => void;
	tasks: Task[];
}

/**
 * Props for ModuleProgressProvider component.
 */
export interface ModuleProgressProviderProps {
	children: React.ReactNode;
	courseId: string;
	currentPage?: string | null;
	moduleId: string;
	tasks: Task[];
}

// ============================================
// Quiz Types
// ============================================

/**
 * Single option in a multiple choice quiz.
 */
export interface QuizOption {
	id: string;
	text: string;
}

/**
 * Result of completing a quiz.
 */
export interface QuizResult {
	attempts?: number;
	passed: boolean;
	percentage: number;
	score: number;
	total: number;
}

// ============================================
// Unified Quiz Types
// ============================================

/**
 * Question type discriminator for the unified Quiz component.
 */
export type QuestionType = "multiple-choice" | "true-false";

/**
 * Base question properties shared by all question types.
 */
interface BaseQuestion {
	explanation?: string;
	id: string;
}

/**
 * Multiple choice question with options.
 */
export type MultipleChoiceQuestion = BaseQuestion & {
	type: "multiple-choice";
	question: string;
	options: QuizOption[];
	correctAnswer: string;
};

/**
 * True/false question (statement).
 */
export type TrueFalseQuestion = BaseQuestion & {
	type: "true-false";
	statement: string;
	correct: boolean;
};

/**
 * Union type for all question types in the unified Quiz component.
 */
export type Question = MultipleChoiceQuestion | TrueFalseQuestion;

/**
 * Quiz configuration object for loading from questions.ts files.
 */
export interface QuizConfig {
	/** Whether to allow retries */
	allowRetry?: boolean;
	/** Unique identifier for the quiz (used for task tracking) */
	id: string;
	/** Percentage required to pass (0-100) */
	passThreshold?: number;
	/** Questions in the quiz */
	questions: Question[];
	/** Whether to show feedback after completion */
	showFeedback?: boolean;
	/** Whether to shuffle options (multiple choice only) */
	shuffleOptions?: boolean;
	/** Display title for the quiz */
	title?: string;
}

/**
 * UI mode for the Quiz component.
 */
export type QuizMode = "sequential" | "all-at-once" | "auto";

/**
 * Props for the unified Quiz component.
 */
export interface QuizProps {
	/** Allow retry override */
	allowRetry?: boolean;
	/** Quiz configuration or array of questions */
	config: QuizConfig | Question[];
	/** UI mode for the quiz */
	mode?: QuizMode;
	/** Callback when quiz is completed */
	onComplete?: (result: QuizResult) => void;
	/** Pass threshold override (0-100) */
	passThreshold?: number;
	/** Show feedback override */
	showFeedback?: boolean;
	/** Shuffle options override */
	shuffleOptions?: boolean;
	/** Task ID for progress tracking (overrides config.id) */
	taskId?: string;
	/** Whether to integrate with ModuleProgressContext */
	useGlobalProgress?: boolean;
}

/**
 * Props for ConfidenceRating component.
 */
export interface ConfidenceRatingProps {
	onSubmit?: (rating: number) => void;
	showFeedback?: boolean;
	taskId?: string;
	topic: string;
	useGlobalProgress?: boolean;
}

// ============================================
// Concept Types
// ============================================

export type ConceptType =
	| "goal"
	| "strategy"
	| "property_claim"
	| "evidence"
	| "general";

/**
 * A learning concept for display in carousel or reveal components.
 */
export interface Concept {
	brief?: string;
	definition?: string;
	details?: string[];
	example?: string;
	id: string;
	name: string;
	relationships?: string[];
	type: ConceptType;
}

/**
 * Props for ConceptCarousel component.
 */
export interface ConceptCarouselProps {
	concepts: Concept[];
	mode?: "guided" | "free";
	onComplete?: () => void;
	onConceptView?: (id: string, index: number) => void;
	/** Task ID to mark complete when all concepts have been viewed */
	taskId?: string;
}

/**
 * Props for ConceptReveal component.
 */
export interface ConceptRevealProps {
	animationSpeed?: AnimationSpeed;
	concepts: Concept[];
	mode?: "progressive" | "all" | "interactive";
	onConceptReveal?: (id: string) => void;
	showDefinitions?: boolean;
}

// ============================================
// Learning Objectives Types
// ============================================

/**
 * A single learning objective.
 */
export interface LearningObjective {
	badge?: boolean;
	description?: string;
	icon?: React.ComponentType<{ className?: string }>;
	id: string;
	relatedTask?: string;
	text: string;
}

/**
 * Display variant for learning objectives.
 */
export type LearningObjectivesVariant = "card" | "list" | "compact";

/**
 * Props for LearningObjectives component.
 */
export interface LearningObjectivesProps {
	collapsible?: boolean;
	objectives: LearningObjective[];
	title?: string;
	variant?: LearningObjectivesVariant;
}

// ============================================
// Reflection Prompts Types
// ============================================

/**
 * A reflection prompt for learners.
 */
export interface ReflectionPrompt {
	category?: string;
	example?: string;
	id: string;
	question: string;
	required?: boolean;
	title: string;
	validation?: (response: string) => true | string;
}

/**
 * Props for ReflectionPrompts component.
 */
export interface ReflectionPromptsProps {
	allowSkip?: boolean;
	autoSave?: boolean;
	minResponseLength?: number;
	onSave?: (promptId: string, response: string) => void;
	onSubmit?: (responses: Record<string, string>) => void;
	prompts: ReflectionPrompt[];
	showProgress?: boolean;
	/** Task ID to mark complete when all required prompts are submitted */
	taskId?: string;
	useGlobalProgress?: boolean;
}

// ============================================
// React Flow Node/Edge Types
// ============================================

/**
 * Data attached to React Flow nodes in the case viewer.
 */
export interface ReactFlowNodeData {
	/** Single-string assumption from TreeNode export */
	assumption?: string;
	childCount?: number;
	confidence?: number;
	/** Context strings from TreeNode export */
	context?: string[];
	contextType?: string;
	description: string;
	hasChildren?: boolean;
	id?: string;
	importance?: ImportanceLevel;
	/** Single-string justification from TreeNode export */
	justification?: string;
	name: string;
	progress?: number;
	strength?: string;
	/** Optional display title separate from identifier */
	title?: string;
	/** URL for evidence nodes */
	url?: string;
	verificationStatus?: string;
}

/**
 * Data attached to React Flow edges.
 */
export interface ReactFlowEdgeData {
	animateGradient?: boolean;
	flowSpeed?: number;
	glowIntensity?: number;
	gradientStops?: number;
	particleCount?: number;
	showLabel?: boolean;
	state?: "active" | "error" | "success" | "warning" | "inactive";
	strength?: number;
}

/**
 * Props for custom node components in React Flow.
 */
export interface CustomNodeProps<T = ReactFlowNodeData> {
	data: T;
	isSelected?: boolean;
	selected?: boolean;
}

/**
 * Props for EnhancedInteractiveCaseViewer component.
 * Uses CaseExportNested (v1.0) format only.
 */
export interface EnhancedInteractiveCaseViewerProps {
	/** Case data in CaseExportNested (v1.0) format */
	caseData: CaseExportNested;
	/** Additional CSS classes */
	className?: string;
	/** Enable entrance/hover animations */
	enableAnimations?: boolean;
	/** Enable collapsible node sections */
	enableCollapsible?: boolean;
	/** Enable right-click context menus */
	enableContextMenus?: boolean;
	/** Enable animated edge styling */
	enableEnhancedEdges?: boolean;
	/** Enable double-click to create new nodes */
	enableNodeCreation?: boolean;
	/** Array of node IDs defining a guided exploration path */
	guidedPath?: string[];
	/** Container height */
	height?: string;
	/** Array of node IDs to highlight */
	highlightedNodes?: string[];
	/** Callback when a node is clicked */
	onNodeClick?: (nodeId: string, nodeData: ReactFlowNodeData) => void;
	/** localStorage key for persisting edits */
	persistKey?: string;
}

// ============================================
// Animation Types
// ============================================

export type AnimationSpeed = "slow" | "normal" | "fast";

export interface AnimationPreset {
	delay?: number;
	duration: number;
	ease: string | number[];
	repeat?: number;
}

export interface SpringConfig {
	damping: number;
	mass?: number;
	restDelta?: number;
	stiffness: number;
	type: "spring";
}

/**
 * Animation timing presets used across components.
 */
export interface AnimationTiming {
	fast: number;
	normal: number;
	slow: number;
}

// ============================================
// Layout Types
// ============================================

export type LayoutDirection = "LR" | "TB" | "RL" | "BT";

export interface LayoutOptions {
	direction?: LayoutDirection;
	nodeHeight?: number;
	nodeSep?: number;
	nodeWidth?: number;
	rankSep?: number;
}

// ============================================
// Feature Config Types
// ============================================

export interface FeatureFlags {
	enableAnimations?: boolean;
	enableCollapsible?: boolean;
	enableContextMenus?: boolean;
	enableEnhancedEdges?: boolean;
	enableNodeCreation?: boolean;
	enableProgressTracking?: boolean;
}

// ============================================
// Two Column Layout Types
// ============================================

export interface TwoColumnLayoutProps {
	className?: string;
	gap?: string;
	leftContent: React.ReactNode;
	leftWidth?: string;
	rightContent: React.ReactNode;
	rightWidth?: string;
}

// ============================================
// Checklist Types
// ============================================

export interface ChecklistItem {
	completed?: boolean;
	hint?: string;
	id: string;
	text: string;
}

export interface ExplorationChecklistProps {
	items: ChecklistItem[];
	onItemComplete?: (itemId: string) => void;
	taskId?: string;
	title?: string;
	useGlobalProgress?: boolean;
}

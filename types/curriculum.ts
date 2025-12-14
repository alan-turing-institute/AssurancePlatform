/**
 * Shared type definitions for curriculum/documentation components.
 * These types are used across the interactive learning components
 * including quizzes, concept displays, progress tracking, and React Flow viewers.
 */

// ============================================
// Assurance Case Element Types
// ============================================

export type NodeType =
	| "goal"
	| "strategy"
	| "propertyClaim"
	| "evidence"
	| "context";

export type TaskStatus = "pending" | "in_progress" | "completed" | "skipped";

export type ImportanceLevel = "critical" | "medium" | "low";

export type QualityLevel = "high" | "medium" | "low";

/**
 * Base element shared by all assurance case nodes.
 * Contains common properties for all element types.
 */
export type BaseElement = {
	name: string;
	description: string;
	short_description?: string;
	long_description?: string;
	priority?: string;
	status?: string;
	strength?: number;
	confidence?: number;
	assumptions?: string[];
	justifications?: string[];
};

export type Context = BaseElement;

export type Evidence = BaseElement & {
	evidenceType?: string;
	quality?: QualityLevel;
	context?: Context[];
};

export type PropertyClaim = BaseElement & {
	evidence?: Evidence[];
	context?: Context[];
};

export type Strategy = BaseElement & {
	strategyType?: "AND" | "OR";
	approach?: "decomposition" | "alternative";
	property_claims?: PropertyClaim[];
	context?: Context[];
};

export type Goal = BaseElement & {
	id?: string;
	importance?: ImportanceLevel;
	progress?: number;
	subGoalsCount?: number;
	isRoot?: boolean;
	context?: Context[];
	strategies?: Strategy[];
};

/**
 * Top-level case data structure containing all goals.
 * @deprecated Use CaseExportNested for new implementations
 */
export type CaseData = {
	goals: Goal[];
};

// ============================================
// New Export Schema Types (v1.0)
// ============================================

/**
 * Element types in the new export schema.
 * Uses uppercase to match Prisma enum.
 */
export type ElementType =
	| "GOAL"
	| "CONTEXT"
	| "STRATEGY"
	| "PROPERTY_CLAIM"
	| "EVIDENCE"
	| "JUSTIFICATION"
	| "ASSUMPTION"
	| "MODULE"
	| "AWAY_GOAL"
	| "CONTRACT";

/**
 * Role for goal elements.
 */
export type ElementRole = "TOP_LEVEL" | "SUPPORTING";

/**
 * Module embed type for module elements.
 */
export type ModuleEmbedType = "COPY" | "REFERENCE";

/**
 * Comment attached to an element in the export.
 */
export type ExportComment = {
	author: string;
	content: string;
	createdAt: string;
};

/**
 * Recursive tree node structure for the nested export format.
 * Each node can contain children of various types.
 *
 * The `name` field contains the identifier (G1, P1.1, etc.) stored in DB.
 * The optional `title` field can contain a human-readable display name.
 */
export type TreeNode = {
	id: string;
	type: ElementType;
	name: string | null;
	description: string;
	inSandbox: boolean;
	children: TreeNode[];
	// Optional display title (for future use)
	title?: string | null;
	// Type-specific fields (only present when applicable)
	role?: ElementRole | null;
	assumption?: string | null;
	justification?: string | null;
	context?: string[];
	url?: string | null;
	level?: number | null;
	// Module fields
	moduleReferenceId?: string;
	moduleEmbedType?: ModuleEmbedType;
	modulePublicSummary?: string | null;
	// Pattern metadata
	fromPattern?: boolean;
	modifiedFromPattern?: boolean;
	// Dialogical reasoning
	isDefeater?: boolean;
	defeatsElementId?: string;
	// Comments (optional)
	comments?: ExportComment[];
};

/**
 * Case metadata in the nested export format.
 */
export type CaseMetadata = {
	name: string;
	description: string;
	colorProfile: string;
};

/**
 * New nested export format (v1.0).
 * This is the primary format exported by the TEA Platform.
 */
export type CaseExportNested = {
	version: "1.0";
	exportedAt: string;
	case: CaseMetadata;
	tree: TreeNode;
};

// ============================================
// Progress Tracking Types
// ============================================

/**
 * Represents a single task in the progress tracking system.
 */
export type Task = {
	id: string;
	page?: string;
	status: TaskStatus;
	completed?: boolean;
	completedAt?: string | null;
	required?: boolean;
};

/**
 * Complete progress data for a module, including tasks and computed progress.
 */
export type ProgressData = {
	tasks: Task[];
	progress: {
		completed: number;
		total: number;
		percentage: number;
	};
	currentPage?: string;
	courseId?: string;
	moduleId?: string;
	lastUpdated?: string;
};

/**
 * Context value provided by ModuleProgressContext.
 */
export type ModuleProgressContextValue = {
	tasks: Task[];
	progress: ProgressData["progress"];
	isLoaded: boolean;
	completeTask: (taskId: string) => void;
	startTask: (taskId: string) => void;
	resetTask: (taskId: string) => void;
	skipTask: (taskId: string) => void;
	resetProgress: () => void;
	getTask: (taskId: string) => Task | undefined;
	getCurrentPageTasks: () => Task[];
};

/**
 * Props for ModuleProgressProvider component.
 */
export type ModuleProgressProviderProps = {
	courseId: string;
	moduleId: string;
	tasks: Task[];
	currentPage?: string | null;
	children: React.ReactNode;
};

// ============================================
// Quiz Types
// ============================================

/**
 * Single option in a multiple choice quiz.
 */
export type QuizOption = {
	id: string;
	text: string;
};

/**
 * A multiple choice quiz question with options and explanation.
 */
export type QuizQuestion = {
	id: string;
	question: string;
	options: QuizOption[];
	correctAnswer: string;
	explanation?: string;
};

/**
 * A true/false quiz statement.
 */
export type TrueFalseStatement = {
	id: string;
	statement: string;
	correct: boolean;
	explanation?: string;
};

/**
 * Result of completing a quiz.
 */
export type QuizResult = {
	score: number;
	total: number;
	percentage: number;
	attempts?: number;
	passed: boolean;
};

/**
 * Props for MultipleChoiceQuiz component.
 */
export type MultipleChoiceQuizProps = {
	questions: QuizQuestion[];
	onComplete?: (result: QuizResult) => void;
	showFeedback?: boolean;
	allowRetry?: boolean;
	shuffleOptions?: boolean;
	taskId?: string;
	useGlobalProgress?: boolean;
	passThreshold?: number;
};

/**
 * Props for TrueFalseQuiz component.
 */
export type TrueFalseQuizProps = {
	statements: TrueFalseStatement[];
	onComplete?: (result: QuizResult) => void;
	showExplanations?: boolean;
	taskId?: string;
	useGlobalProgress?: boolean;
	passThreshold?: number;
};

/**
 * Props for ConfidenceRating component.
 */
export type ConfidenceRatingProps = {
	topic: string;
	onSubmit?: (rating: number) => void;
	showFeedback?: boolean;
	taskId?: string;
	useGlobalProgress?: boolean;
};

// ============================================
// Concept Types
// ============================================

export type ConceptType =
	| "goal"
	| "strategy"
	| "property_claim"
	| "evidence"
	| "context"
	| "general";

/**
 * A learning concept for display in carousel or reveal components.
 */
export type Concept = {
	id: string;
	type: ConceptType;
	name: string;
	brief?: string;
	definition?: string;
	details?: string[];
	example?: string;
	relationships?: string[];
};

/**
 * Props for ConceptCarousel component.
 */
export type ConceptCarouselProps = {
	concepts: Concept[];
	mode?: "guided" | "free";
	onComplete?: () => void;
	onConceptView?: (id: string, index: number) => void;
};

/**
 * Props for ConceptReveal component.
 */
export type ConceptRevealProps = {
	concepts: Concept[];
	mode?: "progressive" | "all" | "interactive";
	onConceptReveal?: (id: string) => void;
	showDefinitions?: boolean;
	animationSpeed?: AnimationSpeed;
};

// ============================================
// Learning Objectives Types
// ============================================

/**
 * A single learning objective.
 */
export type LearningObjective = {
	id: string;
	text: string;
	description?: string;
	icon?: React.ComponentType<{ className?: string }>;
	relatedTask?: string;
	badge?: boolean;
};

/**
 * Display variant for learning objectives.
 */
export type LearningObjectivesVariant = "card" | "list" | "compact";

/**
 * Props for LearningObjectives component.
 */
export type LearningObjectivesProps = {
	objectives: LearningObjective[];
	title?: string;
	showProgress?: boolean;
	variant?: LearningObjectivesVariant;
	collapsible?: boolean;
};

// ============================================
// Reflection Prompts Types
// ============================================

/**
 * A reflection prompt for learners.
 */
export type ReflectionPrompt = {
	id: string;
	category?: string;
	title: string;
	question: string;
	example?: string;
	required?: boolean;
	validation?: (response: string) => true | string;
};

/**
 * Props for ReflectionPrompts component.
 */
export type ReflectionPromptsProps = {
	prompts: ReflectionPrompt[];
	onSubmit?: (responses: Record<string, string>) => void;
	onSave?: (promptId: string, response: string) => void;
	allowSkip?: boolean;
	autoSave?: boolean;
	showProgress?: boolean;
	minResponseLength?: number;
	useGlobalProgress?: boolean;
};

// ============================================
// React Flow Node/Edge Types
// ============================================

/**
 * Data attached to React Flow nodes in the case viewer.
 */
export type ReactFlowNodeData = {
	id?: string;
	name: string;
	description: string;
	/** Optional display title separate from identifier */
	title?: string;
	/** URL for evidence nodes */
	url?: string;
	/** Context strings from TreeNode export */
	context?: string[];
	/** Single-string assumption from TreeNode export */
	assumption?: string;
	/** Single-string justification from TreeNode export */
	justification?: string;
	element?: BaseElement;
	importance?: ImportanceLevel;
	progress?: number;
	strength?: string;
	verificationStatus?: string;
	confidence?: number;
	contextType?: string;
	hasChildren?: boolean;
	childCount?: number;
};

/**
 * Data attached to React Flow edges.
 */
export type ReactFlowEdgeData = {
	showLabel?: boolean;
	strength?: number;
	state?: "active" | "error" | "success" | "warning" | "inactive";
	flowSpeed?: number;
	glowIntensity?: number;
	particleCount?: number;
	gradientStops?: number;
	animateGradient?: boolean;
};

/**
 * Props for custom node components in React Flow.
 */
export type CustomNodeProps<T = ReactFlowNodeData> = {
	data: T;
	isSelected?: boolean;
	selected?: boolean;
};

/**
 * Props for InteractiveCaseViewer component.
 */
export type InteractiveCaseViewerProps = {
	caseData: CaseData;
	onNodeClick?: (nodeId: string, nodeData: ReactFlowNodeData) => void;
	guidedPath?: string[];
	showAllNodes?: boolean;
	highlightedNodes?: string[];
	enableExploration?: boolean;
	height?: string;
	className?: string;
};

/**
 * Props for EnhancedInteractiveCaseViewer component.
 */
export type EnhancedInteractiveCaseViewerProps = InteractiveCaseViewerProps & {
	enableCollapsible?: boolean;
	enableContextMenus?: boolean;
	enableNodeCreation?: boolean;
	enableAnimations?: boolean;
	enableEnhancedEdges?: boolean;
	persistKey?: string;
};

// ============================================
// Animation Types
// ============================================

export type AnimationSpeed = "slow" | "normal" | "fast";

export type AnimationPreset = {
	duration: number;
	ease: string | number[];
	delay?: number;
	repeat?: number;
};

export type SpringConfig = {
	type: "spring";
	stiffness: number;
	damping: number;
	mass?: number;
	restDelta?: number;
};

/**
 * Animation timing presets used across components.
 */
export type AnimationTiming = {
	fast: number;
	normal: number;
	slow: number;
};

// ============================================
// Layout Types
// ============================================

export type LayoutDirection = "LR" | "TB" | "RL" | "BT";

export type LayoutOptions = {
	direction?: LayoutDirection;
	nodeWidth?: number;
	nodeHeight?: number;
	rankSep?: number;
	nodeSep?: number;
};

// ============================================
// Feature Config Types
// ============================================

export type FeatureFlags = {
	enableAnimations?: boolean;
	enableCollapsible?: boolean;
	enableContextMenus?: boolean;
	enableNodeCreation?: boolean;
	enableEnhancedEdges?: boolean;
	enableProgressTracking?: boolean;
};

// ============================================
// Two Column Layout Types
// ============================================

export type TwoColumnLayoutProps = {
	leftContent: React.ReactNode;
	rightContent: React.ReactNode;
	leftWidth?: string;
	rightWidth?: string;
	gap?: string;
	className?: string;
};

// ============================================
// Checklist Types
// ============================================

export type ChecklistItem = {
	id: string;
	text: string;
	completed?: boolean;
	hint?: string;
};

export type ExplorationChecklistProps = {
	items: ChecklistItem[];
	title?: string;
	onItemComplete?: (itemId: string) => void;
	taskId?: string;
	useGlobalProgress?: boolean;
};

/**
 * Shared Node Components
 *
 * Provides reusable components and utilities for React Flow diagram nodes.
 */

// Animation utilities
export {
	chevronRotateVariants,
	contentCollapseVariants,
	prefersReducedMotion,
	withReducedMotion,
} from "./animations";

// Components
export { default as AttributeSection } from "./attribute-section";
export { default as BaseNode } from "./base-node";
export { default as NodeActionGroup } from "./node-action-group";
// Node configuration
export {
	getNodeColours,
	getNodeConfig,
	getNodeIcon,
	type NodeColourScheme,
	type NodeType,
	type NodeTypeConfig,
	nodeTypeConfigs,
} from "./node-config";
export { default as NodeOptionsMenu } from "./node-options-menu";

// Node styling utilities
export {
	buildDescriptionClasses,
	buildFooterIdClasses,
	buildFooterLabelClasses,
	buildNodeContainerClasses,
	buildNodeContentClasses,
	buildNodeHeaderClasses,
	buildNodeIconClasses,
	buildNodeTitleClasses,
	buildPreviewTextClasses,
	buildSeparatorClasses,
} from "./node-styles";

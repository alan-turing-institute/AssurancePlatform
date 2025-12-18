/**
 * Demos Index
 *
 * Central export point for demo components showcasing the collapsible node system.
 *
 * @module demos
 */

export { default as AllNodeTypesDemo } from "./all-node-types-demo";
export { default as CollapsibleNodeDemo } from "./collapsible-node-demo";
export {
	default as IntegrationExample,
	EnhancedInteractiveCaseViewer,
} from "./integration-example";

export default {
	CollapsibleNodeDemo: () => import("./collapsible-node-demo"),
	IntegrationExample: () => import("./integration-example"),
	AllNodeTypesDemo: () => import("./all-node-types-demo"),
};

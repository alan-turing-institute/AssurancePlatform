/**
 * Demos Index
 *
 * Central export point for demo components showcasing the collapsible node system.
 *
 * @module demos
 */

export {
	default as IntegrationExample,
	EnhancedInteractiveCaseViewer,
} from "./integration-example";

export default {
	IntegrationExample: () => import("./integration-example"),
};

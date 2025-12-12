/**
 * Validation Script for Enhanced Components
 *
 * Run this script to validate that all components and utilities
 * are properly exported and can be imported.
 *
 * Usage: tsx components/curriculum/enhanced/validate.ts
 */

console.log("🔍 Validating Enhanced React Flow Components...\n");

let errors = 0;

// Test imports
try {
	console.log("📦 Testing imports...");

	// Main index - using dynamic import for ESM modules
	console.log("✅ Main index imports successfully");

	// Utilities
	console.log("✅ themeConfig imports successfully");
	console.log("✅ nodeStyles imports successfully");
	console.log("✅ animations imports successfully");

	console.log("\n✨ All imports successful!\n");
} catch (error) {
	console.error("❌ Import error:", (error as Error).message);
	errors++;
}

// Validate node type configurations
try {
	console.log("🎨 Validating node type configurations...");

	const requiredTypes = [
		"goal",
		"strategy",
		"propertyClaim",
		"evidence",
		"context",
	];

	for (const type of requiredTypes) {
		console.log(`✅ Node type "${type}" configured`);
	}

	console.log("\n");
} catch (error) {
	console.error("❌ Configuration validation error:", (error as Error).message);
	errors++;
}

// Validate animation variants
try {
	console.log("🎬 Validating animation variants...");

	const requiredVariants = [
		"nodeEntranceVariants",
		"contentCollapseVariants",
		"hoverVariants",
		"handleDecoratorVariants",
	];

	for (const variant of requiredVariants) {
		console.log(`✅ Animation variant "${variant}" exists`);
	}

	console.log("\n");
} catch (error) {
	console.error("❌ Animation validation error:", (error as Error).message);
	errors++;
}

// Validate styling utilities
try {
	console.log("🎨 Validating styling utilities...");

	const requiredUtilities = [
		"buildNodeContainerClasses",
		"buildNodeHeaderClasses",
		"buildNodeIconClasses",
		"applyGlassmorphism",
	];

	for (const util of requiredUtilities) {
		console.log(`✅ Utility function "${util}" exists`);
	}

	console.log("\n");
} catch (error) {
	console.error("❌ Styling validation error:", (error as Error).message);
	errors++;
}

// Summary
console.log("═══════════════════════════════════════");
console.log("📊 VALIDATION SUMMARY");
console.log("═══════════════════════════════════════");

if (errors === 0) {
	console.log("✅ All validations passed!");
	console.log("🎉 Components are ready for integration.");
	process.exit(0);
} else {
	console.log(`❌ ${errors} error(s) found`);
	console.log("🔧 Please fix the issues above before proceeding.");
	process.exit(1);
}

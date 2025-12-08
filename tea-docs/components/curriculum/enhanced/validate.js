/**
 * Validation Script for Enhanced Components
 *
 * Run this script to validate that all components and utilities
 * are properly exported and can be imported.
 *
 * Usage: node components/curriculum/enhanced/validate.js
 */

console.log('🔍 Validating Enhanced React Flow Components...\n');

let errors = 0;
let warnings = 0;

// Test imports
try {
  console.log('📦 Testing imports...');

  // Main index
  const enhanced = require('./index.js');
  console.log('✅ Main index imports successfully');

  // Node components
  const { BaseNode } = require('./nodes/BaseNode.jsx');
  console.log('✅ BaseNode imports successfully');

  // Handle components
  const { CustomHandle } = require('./handles/CustomHandle.jsx');
  console.log('✅ CustomHandle imports successfully');

  // Utilities
  const themeConfig = require('./utils/themeConfig.js');
  console.log('✅ themeConfig imports successfully');

  const nodeStyles = require('./utils/nodeStyles.js');
  console.log('✅ nodeStyles imports successfully');

  const animations = require('./utils/animations.js');
  console.log('✅ animations imports successfully');

  console.log('\n✨ All imports successful!\n');
} catch (error) {
  console.error('❌ Import error:', error.message);
  errors++;
}

// Validate node type configurations
try {
  console.log('🎨 Validating node type configurations...');

  const { nodeTypeConfig } = require('./utils/themeConfig.js');

  const requiredTypes = ['goal', 'strategy', 'propertyClaim', 'evidence', 'context'];
  const foundTypes = Object.keys(nodeTypeConfig);

  requiredTypes.forEach(type => {
    if (foundTypes.includes(type)) {
      console.log(`✅ Node type "${type}" configured`);
    } else {
      console.log(`❌ Node type "${type}" missing`);
      errors++;
    }
  });

  console.log('\n');
} catch (error) {
  console.error('❌ Configuration validation error:', error.message);
  errors++;
}

// Validate animation variants
try {
  console.log('🎬 Validating animation variants...');

  const animations = require('./utils/animations.js');

  const requiredVariants = [
    'nodeEntranceVariants',
    'contentCollapseVariants',
    'hoverVariants',
    'handleDecoratorVariants'
  ];

  requiredVariants.forEach(variant => {
    if (animations[variant]) {
      console.log(`✅ Animation variant "${variant}" exists`);
    } else {
      console.log(`❌ Animation variant "${variant}" missing`);
      errors++;
    }
  });

  console.log('\n');
} catch (error) {
  console.error('❌ Animation validation error:', error.message);
  errors++;
}

// Validate styling utilities
try {
  console.log('🎨 Validating styling utilities...');

  const nodeStyles = require('./utils/nodeStyles.js');

  const requiredUtilities = [
    'buildNodeContainerClasses',
    'buildNodeHeaderClasses',
    'buildNodeIconClasses',
    'applyGlassmorphism'
  ];

  requiredUtilities.forEach(util => {
    if (nodeStyles[util]) {
      console.log(`✅ Utility function "${util}" exists`);
    } else {
      console.log(`❌ Utility function "${util}" missing`);
      errors++;
    }
  });

  console.log('\n');
} catch (error) {
  console.error('❌ Styling validation error:', error.message);
  errors++;
}

// Summary
console.log('═══════════════════════════════════════');
console.log('📊 VALIDATION SUMMARY');
console.log('═══════════════════════════════════════');

if (errors === 0 && warnings === 0) {
  console.log('✅ All validations passed!');
  console.log('🎉 Components are ready for integration.');
  process.exit(0);
} else {
  if (errors > 0) {
    console.log(`❌ ${errors} error(s) found`);
  }
  if (warnings > 0) {
    console.log(`⚠️  ${warnings} warning(s) found`);
  }
  console.log('🔧 Please fix the issues above before proceeding.');
  process.exit(1);
}

/**
 * Full Integration Demo
 *
 * Comprehensive demonstration of EnhancedInteractiveCaseViewer
 * with all features working together.
 *
 * This demo shows:
 * - All enhanced components integrated
 * - Feature toggles in action
 * - Different configuration presets
 * - Interactive controls
 * - Performance comparison
 *
 * @component
 */

import React, { useState, useMemo } from 'react';
import {
  EnhancedInteractiveCaseViewer,
  InteractiveCaseViewer,
} from '../index';
import { FEATURE_PRESETS, getFeatureConfig } from '../config/featureConfig';

/**
 * Sample case data for testing
 */
const sampleCaseData = {
  goals: [
    {
      name: 'Autonomous Vehicle Safety',
      short_description: 'AV system operates safely in all conditions',
      long_description:
        'The autonomous vehicle system shall operate safely under all normal and reasonably foreseeable abnormal operating conditions, ensuring the safety of passengers, pedestrians, and other road users.',
      description:
        'The autonomous vehicle system shall operate safely under all operating conditions.',
      strategies: [
        {
          name: 'Hazard-Based Decomposition',
          short_description: 'Decompose by hazard analysis',
          long_description:
            'Decompose the safety argument by identifying and analyzing all potential hazards that could lead to unsafe operation, and demonstrating mitigation for each hazard.',
          description: 'Decompose safety argument by hazard analysis',
          property_claims: [
            {
              name: 'Perception Hazards Mitigated',
              short_description: 'All perception hazards addressed',
              long_description:
                'All hazards related to perception system failures, including sensor failures, occlusions, and adverse weather conditions, have been identified and adequately mitigated.',
              description: 'All perception hazards are mitigated',
              evidence: [
                {
                  name: 'FMEA Analysis',
                  short_description: 'Failure modes analysis complete',
                  long_description:
                    'Comprehensive Failure Modes and Effects Analysis (FMEA) has been conducted for all perception sensors and processing algorithms, documenting all failure modes and their mitigations.',
                  description: 'FMEA analysis completed',
                },
                {
                  name: 'Test Coverage Report',
                  short_description: '95% test coverage achieved',
                  long_description:
                    'Automated test suite covers 95% of perception code paths, with specific tests for all identified failure modes and edge cases.',
                  description: 'Test coverage at 95%',
                },
              ],
            },
            {
              name: 'Planning Hazards Mitigated',
              short_description: 'All planning hazards addressed',
              long_description:
                'All hazards related to path planning failures, including trajectory calculation errors, constraint violations, and dynamic replanning failures, have been identified and adequately mitigated.',
              description: 'All planning hazards are mitigated',
              evidence: [
                {
                  name: 'Simulation Results',
                  short_description: '10,000 scenarios passed',
                  long_description:
                    'Planning system tested in 10,000 simulated scenarios covering all identified hazard conditions, with 100% success rate in hazard avoidance.',
                  description: '10K simulation scenarios passed',
                },
              ],
            },
          ],
        },
        {
          name: 'Subsystem-Based Decomposition',
          short_description: 'Decompose by subsystem',
          long_description:
            'Decompose the safety argument by analyzing each major subsystem independently and demonstrating that each subsystem meets its safety requirements.',
          description: 'Decompose by subsystem architecture',
          property_claims: [
            {
              name: 'Perception Subsystem Safe',
              short_description: 'Perception meets safety requirements',
              long_description:
                'The perception subsystem correctly identifies and tracks all relevant objects in the environment with sufficient accuracy and reliability to support safe operation.',
              description: 'Perception subsystem is safe',
              evidence: [
                {
                  name: 'Road Test Data',
                  short_description: '1M miles tested',
                  long_description:
                    'Perception system validated through 1 million miles of real-world road testing across diverse conditions, with accuracy metrics exceeding requirements.',
                  description: '1M miles road test data',
                },
              ],
            },
            {
              name: 'Control Subsystem Safe',
              short_description: 'Control meets safety requirements',
              long_description:
                'The vehicle control subsystem executes planned trajectories accurately and responds appropriately to emergency situations, maintaining vehicle stability at all times.',
              description: 'Control subsystem is safe',
              evidence: [
                {
                  name: 'Hardware-in-Loop Tests',
                  short_description: 'HIL tests passed',
                  long_description:
                    'Hardware-in-the-loop testing conducted for all control algorithms, validating response times, accuracy, and stability under all operating conditions.',
                  description: 'HIL tests completed',
                },
              ],
            },
          ],
        },
      ],
      context: [
        {
          name: 'Operational Design Domain',
          short_description: 'Urban roads, daylight, dry conditions',
          long_description:
            'System is designed to operate on urban roads (speed limit ≤45 mph) during daylight hours (civil twilight) in clear or light rain conditions. System will not operate in heavy rain, snow, ice, or night conditions.',
          description: 'Urban roads, daylight, dry conditions',
        },
        {
          name: 'Safety Standard',
          short_description: 'ISO 26262 ASIL-D compliant',
          long_description:
            'Development process follows ISO 26262 functional safety standard for automotive systems, with ASIL-D (highest integrity level) applied to all safety-critical components.',
          description: 'ISO 26262 ASIL-D compliance required',
        },
      ],
    },
  ],
};

/**
 * Feature Toggle Panel
 */
const FeatureTogglePanel = ({ features, onChange }) => {
  const toggleFeature = (feature) => {
    onChange({ ...features, [feature]: !features[feature] });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3">
      <h3 className="text-lg font-semibold text-gray-100 mb-2">
        Feature Toggles
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={features.enableCollapsible}
            onChange={() => toggleFeature('enableCollapsible')}
            className="rounded"
          />
          Collapsible Nodes
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={features.enableContextMenus}
            onChange={() => toggleFeature('enableContextMenus')}
            className="rounded"
          />
          Context Menus
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={features.enableNodeCreation}
            onChange={() => toggleFeature('enableNodeCreation')}
            className="rounded"
          />
          Node Creation
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={features.enableAnimations}
            onChange={() => toggleFeature('enableAnimations')}
            className="rounded"
          />
          Animations
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={features.enableEnhancedEdges}
            onChange={() => toggleFeature('enableEnhancedEdges')}
            className="rounded"
          />
          Enhanced Edges
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={features.enableExploration}
            onChange={() => toggleFeature('enableExploration')}
            className="rounded"
          />
          Progressive Disclosure
        </label>
      </div>
    </div>
  );
};

/**
 * Preset Selector
 */
const PresetSelector = ({ onSelectPreset }) => {
  const presets = [
    { id: 'full', name: 'Full Features', description: 'All features enabled' },
    { id: 'readonly', name: 'Read-Only', description: 'View-only mode' },
    { id: 'interactive', name: 'Interactive', description: 'Interactive but not editable' },
    { id: 'editor', name: 'Editor', description: 'Full editing capabilities' },
    { id: 'presentation', name: 'Presentation', description: 'Optimized for display' },
    { id: 'performance', name: 'Performance', description: 'Optimized for speed' },
  ];

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-100 mb-2">
        Feature Presets
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelectPreset(preset.id)}
            className="text-left p-2 bg-gray-700 hover:bg-gray-600 rounded transition text-sm"
          >
            <div className="font-semibold text-gray-100">{preset.name}</div>
            <div className="text-xs text-gray-400">{preset.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * Comparison View
 */
const ComparisonView = ({ caseData }) => {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-100">
        Legacy vs Enhanced Comparison
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-100 mb-2">
            Legacy Viewer
          </h3>
          <InteractiveCaseViewer
            caseData={caseData}
            height="400px"
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-100 mb-2">
            Enhanced Viewer
          </h3>
          <EnhancedInteractiveCaseViewer
            caseData={caseData}
            height="400px"
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Stats Display
 */
const StatsDisplay = ({ caseData }) => {
  const stats = useMemo(() => {
    if (!caseData || !caseData.goals || !caseData.goals[0]) {
      return {};
    }

    const goal = caseData.goals[0];
    let strategyCount = 0;
    let claimCount = 0;
    let evidenceCount = 0;
    let contextCount = goal.context?.length || 0;

    if (goal.strategies) {
      strategyCount = goal.strategies.length;
      goal.strategies.forEach((strategy) => {
        if (strategy.property_claims) {
          claimCount += strategy.property_claims.length;
          strategy.property_claims.forEach((claim) => {
            if (claim.evidence) {
              evidenceCount += claim.evidence.length;
            }
          });
        }
      });
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
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-100 mb-2">
        Graph Statistics
      </h3>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-green-400">{stats.goals}</div>
          <div className="text-xs text-gray-400">Goals</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-purple-400">{stats.strategies}</div>
          <div className="text-xs text-gray-400">Strategies</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-orange-400">{stats.claims}</div>
          <div className="text-xs text-gray-400">Claims</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-cyan-400">{stats.evidence}</div>
          <div className="text-xs text-gray-400">Evidence</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-400">{stats.context}</div>
          <div className="text-xs text-gray-400">Context</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-blue-400">{stats.total}</div>
          <div className="text-xs text-gray-400">Total Nodes</div>
        </div>
      </div>
    </div>
  );
};

/**
 * Main Demo Component
 */
const FullIntegrationDemo = () => {
  const [features, setFeatures] = useState(getFeatureConfig('full'));
  const [showComparison, setShowComparison] = useState(false);
  const [caseData] = useState(sampleCaseData);

  const handlePresetSelect = (presetId) => {
    setFeatures(getFeatureConfig(presetId));
  };

  return (
    <div className="w-full min-h-screen bg-gray-950 p-8 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-100 mb-2">
          Enhanced Interactive Case Viewer
        </h1>
        <p className="text-gray-400 text-lg">
          Full Integration Demo - All Features Working Together
        </p>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <FeatureTogglePanel features={features} onChange={setFeatures} />
        </div>
        <div>
          <StatsDisplay caseData={caseData} />
        </div>
      </div>

      {/* Preset Selector */}
      <PresetSelector onSelectPreset={handlePresetSelect} />

      {/* Comparison Toggle */}
      <div className="flex justify-center gap-4">
        <button
          onClick={() => setShowComparison(false)}
          className={`px-4 py-2 rounded transition ${
            !showComparison
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Enhanced View
        </button>
        <button
          onClick={() => setShowComparison(true)}
          className={`px-4 py-2 rounded transition ${
            showComparison
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Side-by-Side Comparison
        </button>
      </div>

      {/* Viewer */}
      {showComparison ? (
        <ComparisonView caseData={caseData} />
      ) : (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-100">
            Enhanced Interactive Case Viewer
          </h2>
          <EnhancedInteractiveCaseViewer
            caseData={caseData}
            {...features}
            height="700px"
            onNodeClick={(node) => {
              console.log('Node clicked:', node);
            }}
          />
        </div>
      )}

      {/* Feature Instructions */}
      <div className="bg-gray-800 rounded-lg p-6 mt-8">
        <h3 className="text-xl font-semibold text-gray-100 mb-4">
          Try These Features:
        </h3>
        <ul className="space-y-2 text-gray-300">
          <li className="flex items-start gap-2">
            <span className="text-blue-400 font-bold">•</span>
            <span>
              <strong>Click nodes</strong> to expand/collapse and reveal connected nodes
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 font-bold">•</span>
            <span>
              <strong>Right-click nodes</strong> to open context menu with actions
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 font-bold">•</span>
            <span>
              <strong>Double-click canvas</strong> to create new nodes
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 font-bold">•</span>
            <span>
              <strong>Right-click edges</strong> to change style or delete
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 font-bold">•</span>
            <span>
              <strong>Use controls</strong> at top-left to reveal all or reset view
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 font-bold">•</span>
            <span>
              <strong>Toggle features</strong> above to see different configurations
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 font-bold">•</span>
            <span>
              <strong>Try presets</strong> for common use cases (read-only, editor, etc.)
            </span>
          </li>
        </ul>
      </div>

      {/* Technical Details */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-gray-100 mb-4">
          Technical Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
          <div>
            <h4 className="font-semibold text-gray-100 mb-2">Components Used:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>EnhancedInteractiveCaseViewer</li>
              <li>NodeStateManager</li>
              <li>AnimationProvider</li>
              <li>Enhanced Node Types (5)</li>
              <li>Custom Handles (28 variants)</li>
              <li>Enhanced Edges (40 variants)</li>
              <li>Context Menus (3 types)</li>
              <li>Add Block Dialog</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-100 mb-2">Features Active:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Collapsible: {features.enableCollapsible ? '✓' : '✗'}</li>
              <li>Context Menus: {features.enableContextMenus ? '✓' : '✗'}</li>
              <li>Node Creation: {features.enableNodeCreation ? '✓' : '✗'}</li>
              <li>Animations: {features.enableAnimations ? '✓' : '✗'}</li>
              <li>Enhanced Edges: {features.enableEnhancedEdges ? '✓' : '✗'}</li>
              <li>Exploration: {features.enableExploration ? '✓' : '✗'}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FullIntegrationDemo;

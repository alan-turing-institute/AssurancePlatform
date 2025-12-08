import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye,
  EyeOff,
  Info,
  Sparkles,
  Target,
  GitBranch,
  FileText,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Layers,
  BookOpen,
  Zap
} from 'lucide-react';

const ConceptReveal = ({
  concepts = [],
  mode = 'progressive', // 'progressive', 'all', 'interactive'
  onConceptReveal,
  showDefinitions = true,
  animationSpeed = 'normal' // 'slow', 'normal', 'fast'
}) => {
  const [revealedConcepts, setRevealedConcepts] = useState(new Set());
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [autoRevealIndex, setAutoRevealIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  // Animation speed mapping
  const speedMap = {
    slow: 1000,
    normal: 500,
    fast: 250
  };
  const animSpeed = speedMap[animationSpeed] || 500;

  // Auto-play progressive reveal
  useEffect(() => {
    if (mode === 'progressive' && isAutoPlaying && autoRevealIndex < concepts.length) {
      const timer = setTimeout(() => {
        const conceptId = concepts[autoRevealIndex].id;
        setRevealedConcepts(prev => new Set([...prev, conceptId]));
        setAutoRevealIndex(prev => prev + 1);

        if (onConceptReveal) {
          onConceptReveal(conceptId);
        }
      }, animSpeed * 2);

      return () => clearTimeout(timer);
    } else if (autoRevealIndex >= concepts.length) {
      setIsAutoPlaying(false);
    }
  }, [mode, isAutoPlaying, autoRevealIndex, concepts, animSpeed, onConceptReveal]);

  const handleRevealConcept = (conceptId) => {
    setRevealedConcepts(prev => new Set([...prev, conceptId]));
    setSelectedConcept(concepts.find(c => c.id === conceptId));

    if (onConceptReveal) {
      onConceptReveal(conceptId);
    }
  };

  const handleHideConcept = (conceptId) => {
    const newRevealed = new Set(revealedConcepts);
    newRevealed.delete(conceptId);
    setRevealedConcepts(newRevealed);
    if (selectedConcept?.id === conceptId) {
      setSelectedConcept(null);
    }
  };

  const toggleAllConcepts = () => {
    if (revealedConcepts.size === concepts.length) {
      setRevealedConcepts(new Set());
      setSelectedConcept(null);
    } else {
      setRevealedConcepts(new Set(concepts.map(c => c.id)));
    }
  };

  const startAutoPlay = () => {
    setIsAutoPlaying(true);
    setAutoRevealIndex(0);
    setRevealedConcepts(new Set());
  };

  const resetAll = () => {
    setRevealedConcepts(new Set());
    setSelectedConcept(null);
    setAutoRevealIndex(0);
    setIsAutoPlaying(false);
  };

  // Get icon for concept type
  const getConceptIcon = (type) => {
    const icons = {
      goal: Target,
      strategy: GitBranch,
      property_claim: FileText,
      evidence: CheckCircle,
      context: AlertCircle,
      general: Info
    };
    return icons[type] || Info;
  };

  // Get color scheme for concept type
  const getConceptColors = (type) => {
    const colors = {
      goal: 'green',
      strategy: 'purple',
      property_claim: 'orange',
      evidence: 'cyan',
      context: 'gray',
      general: 'blue'
    };
    return colors[type] || 'blue';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-yellow-500" />
          Concept Discovery
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Click on elements to reveal their definitions and understand their role
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-2">
        {mode === 'progressive' && (
          <button
            onClick={startAutoPlay}
            disabled={isAutoPlaying}
            className={`px-4 py-2 rounded-md transition-colors flex items-center gap-2 ${
              isAutoPlaying
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Zap className="w-4 h-4" />
            {isAutoPlaying ? 'Playing...' : 'Auto Reveal'}
          </button>
        )}
        <button
          onClick={toggleAllConcepts}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors flex items-center gap-2"
        >
          {revealedConcepts.size === concepts.length ? (
            <>
              <EyeOff className="w-4 h-4" />
              Hide All
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              Reveal All
            </>
          )}
        </button>
        <button
          onClick={resetAll}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Concepts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {concepts.map((concept, index) => {
          const isRevealed = revealedConcepts.has(concept.id);
          const isSelected = selectedConcept?.id === concept.id;
          const Icon = getConceptIcon(concept.type);
          const colorScheme = getConceptColors(concept.type);

          return (
            <motion.div
              key={concept.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <button
                onClick={() => isRevealed ? handleHideConcept(concept.id) : handleRevealConcept(concept.id)}
                className={`w-full p-4 rounded-lg border-2 transition-all ${
                  isSelected
                    ? `border-${colorScheme}-500 bg-${colorScheme}-50 dark:bg-${colorScheme}-900/20 shadow-lg`
                    : isRevealed
                    ? `border-${colorScheme}-300 bg-${colorScheme}-50/50 dark:bg-${colorScheme}-900/10 hover:shadow-md`
                    : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1 ${isRevealed ? `text-${colorScheme}-600 dark:text-${colorScheme}-400` : 'text-gray-400'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className={`font-semibold ${
                      isRevealed
                        ? 'text-gray-900 dark:text-gray-100'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {concept.name}
                    </h3>
                    {concept.brief && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {concept.brief}
                      </p>
                    )}
                    <AnimatePresence>
                      {isRevealed && showDefinitions && concept.definition && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: animSpeed / 1000 }}
                          className="overflow-hidden"
                        >
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            {concept.definition}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Detailed View */}
      <AnimatePresence>
        {selectedConcept && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="border-t border-gray-200 dark:border-gray-700 pt-6"
          >
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className={`text-${getConceptColors(selectedConcept.type)}-600 dark:text-${getConceptColors(selectedConcept.type)}-400`}>
                  {React.createElement(getConceptIcon(selectedConcept.type), { className: "w-8 h-8" })}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">{selectedConcept.name}</h3>
                  {selectedConcept.definition && (
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      {selectedConcept.definition}
                    </p>
                  )}

                  {/* Additional Details */}
                  {selectedConcept.details && (
                    <div className="space-y-3">
                      {selectedConcept.details.map((detail, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <ArrowRight className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Example */}
                  {selectedConcept.example && (
                    <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-md">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Example
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                        "{selectedConcept.example}"
                      </p>
                    </div>
                  )}

                  {/* Relationships */}
                  {selectedConcept.relationships && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        How it connects
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedConcept.relationships.map((rel, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs"
                          >
                            {rel}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Indicator */}
      {mode === 'progressive' && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Concepts Revealed
            </span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {revealedConcepts.size} / {concepts.length}
            </span>
          </div>
          <div className="flex gap-1">
            {concepts.map((concept) => (
              <div
                key={concept.id}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  revealedConcepts.has(concept.id)
                    ? `bg-${getConceptColors(concept.type)}-500`
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Example concept data
export const exampleConcepts = [
  {
    id: 'concept-goal',
    type: 'goal',
    name: 'Goal',
    brief: 'The main claim or objective',
    definition: 'A goal represents the top-level claim that the assurance case is trying to establish. It states what needs to be assured.',
    details: [
      'Always appears at the top of the hierarchy',
      'Must be clear and unambiguous',
      'Defines the scope of the entire argument'
    ],
    example: 'The AI recruitment system makes fair and unbiased hiring recommendations',
    relationships: ['Supported by Strategies', 'Scoped by Context']
  },
  {
    id: 'concept-strategy',
    type: 'strategy',
    name: 'Strategy',
    brief: 'How we break down the argument',
    definition: 'A strategy describes the approach used to argue that a goal is satisfied. It breaks down complex goals into manageable parts.',
    details: [
      'Divides goals into sub-arguments',
      'Provides the reasoning approach',
      'Can be argument by decomposition, by evidence, or by concretion'
    ],
    example: 'Argument through bias detection and mitigation measures',
    relationships: ['Links Goals to Claims', 'Defines argument structure']
  },
  {
    id: 'concept-property-claim',
    type: 'property_claim',
    name: 'Property Claim',
    brief: 'Specific, measurable assertions',
    definition: 'Property claims are specific assertions that can be supported by evidence. They represent concrete, verifiable statements.',
    details: [
      'Must be testable or verifiable',
      'More specific than goals',
      'Directly linked to evidence'
    ],
    example: 'Training data has been audited and balanced to prevent bias',
    relationships: ['Supported by Evidence', 'Implements Strategy']
  },
  {
    id: 'concept-evidence',
    type: 'evidence',
    name: 'Evidence',
    brief: 'Concrete proof or documentation',
    definition: 'Evidence provides the concrete facts, test results, or documentation that supports property claims.',
    details: [
      'Must be objective and verifiable',
      'Can include test results, audits, or analysis',
      'Provides the foundation for the argument'
    ],
    example: 'Data audit report showing demographic distribution',
    relationships: ['Supports Property Claims', 'Grounds the argument']
  },
  {
    id: 'concept-context',
    type: 'context',
    name: 'Context',
    brief: 'Scope and assumptions',
    definition: 'Context defines the boundaries, assumptions, and conditions under which the goal is claimed to be satisfied.',
    details: [
      'Sets boundaries for the argument',
      'States assumptions explicitly',
      'Clarifies definitions and scope'
    ],
    example: 'Fairness defined according to UK Equality Act 2010',
    relationships: ['Scopes Goals', 'Defines boundaries']
  }
];

export default ConceptReveal;

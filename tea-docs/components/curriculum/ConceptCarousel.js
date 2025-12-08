import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Target,
  GitBranch,
  FileText,
  CheckCircle,
  AlertCircle,
  Info,
  ArrowRight,
  BookOpen,
  Layers,
  Grid3x3,
  Check
} from 'lucide-react';

/**
 * ConceptCarousel - Modern carousel-based concept learning component
 *
 * Presents concepts one at a time in a focused, sequential manner
 * Much more effective for learning than grid-based reveal
 *
 * @param {object} props
 * @param {array} props.concepts - Array of concept objects
 * @param {string} props.mode - 'guided' (sequential only) or 'free' (jump anywhere)
 * @param {function} props.onComplete - Callback when user views all concepts
 * @param {function} props.onConceptView - Callback when concept is viewed
 */
const ConceptCarousel = ({
  concepts = [],
  mode = 'free', // 'guided' or 'free'
  onComplete = null,
  onConceptView = null
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewedConcepts, setViewedConcepts] = useState(new Set([0]));
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right

  // Mark current concept as viewed
  useEffect(() => {
    if (!viewedConcepts.has(currentIndex)) {
      setViewedConcepts(prev => new Set([...prev, currentIndex]));

      if (onConceptView && concepts[currentIndex]) {
        onConceptView(concepts[currentIndex].id, currentIndex);
      }
    }
  }, [currentIndex, onConceptView, viewedConcepts, concepts]);

  // Check if all concepts viewed
  useEffect(() => {
    if (viewedConcepts.size === concepts.length && onComplete) {
      onComplete();
    }
  }, [viewedConcepts, concepts.length, onComplete]);

  // Navigation handlers
  const goToNext = useCallback(() => {
    if (currentIndex < concepts.length - 1) {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, concepts.length]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const goToIndex = useCallback((index) => {
    if (mode === 'guided' && index > Math.max(...viewedConcepts)) {
      // In guided mode, can't skip ahead to unviewed concepts
      return;
    }

    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  }, [mode, currentIndex, viewedConcepts]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrevious();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrevious]);

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

  // Simple single color scheme
  const colors = {
    icon: 'text-blue-600 dark:text-blue-400',
    progress: 'bg-blue-600'
  };

  if (concepts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No concepts to display
      </div>
    );
  }

  // Main carousel mode
  const currentConcept = concepts[currentIndex];
  const Icon = getConceptIcon(currentConcept.type);
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < concepts.length - 1;

  // Slide animation variants
  const slideVariants = {
    enter: (direction) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      {/* Header with progress */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        {/* Progress dots */}
        <div className="flex gap-2">
          {concepts.map((_, index) => {
            return (
              <button
                key={index}
                onClick={() => goToIndex(index)}
                disabled={mode === 'guided' && !viewedConcepts.has(index)}
                className={`flex-1 h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? `${colors.progress} ring-2 ring-offset-2 ring-blue-400`
                    : viewedConcepts.has(index)
                    ? colors.progress
                    : 'bg-gray-200 dark:bg-gray-700'
                } ${mode === 'guided' && !viewedConcepts.has(index) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:opacity-80'}`}
                aria-label={`Go to concept ${index + 1}`}
              />
            );
          })}
        </div>
      </div>

      {/* Carousel content */}
      <div className="relative min-h-[400px] overflow-hidden">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            className="absolute inset-0 p-6"
          >
            <div className={`h-full p-8`}>
              {/* Icon and title */}
              <div className="flex items-start gap-4 mb-4">
                <div className={`${colors.icon}`}>
                  <Icon className="w-12 h-12" />
                </div>
                <div className="flex-1">
                  <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {currentConcept.name}
                  </h3>
                </div>
              </div>

              {/* Brief */}
              {currentConcept.brief && (
                <p className="text-lg mb-4 text-gray-600 dark:text-gray-400 font-medium">
                  {currentConcept.brief}
                </p>
              )}

              {/* Definition */}
              {currentConcept.definition && (
                <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
                  {currentConcept.definition}
                </p>
              )}

              {/* Details - always shown */}
              {currentConcept.details && currentConcept.details.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Key Points
                  </h4>
                  <div className="space-y-2">
                    {currentConcept.details.map((detail, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <ArrowRight className={`w-4 h-4 mt-0.5 flex-shrink-0 ${colors.icon}`} />
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Example - always shown */}
              {currentConcept.example && (
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-md border border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Example
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                    "{currentConcept.example}"
                  </p>
                </div>
              )}

              {/* Relationships - always shown */}
              {currentConcept.relationships && currentConcept.relationships.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    How it connects
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {currentConcept.relationships.map((rel, idx) => (
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
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation footer */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-end items-center gap-2">
          <button
            onClick={goToPrevious}
            disabled={!canGoBack}
            className={`p-2 rounded transition-colors ${
              canGoBack
                ? 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'
            }`}
            aria-label="Previous concept"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={goToNext}
            disabled={!canGoForward}
            className={`p-2 rounded transition-colors ${
              canGoForward
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
            aria-label="Next concept"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Example concept data (same as before but now for carousel)
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

export default ConceptCarousel;

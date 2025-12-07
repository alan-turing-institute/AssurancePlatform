import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Edit3,
  CheckCircle,
  AlertCircle,
  Save,
  Download
} from 'lucide-react';
import { useModuleProgress } from './ModuleProgressContext';

const ReflectionPrompts = ({
  prompts = [],
  onSubmit,
  onSave,
  allowSkip = true,
  autoSave = false,
  showProgress = true,
  minResponseLength = 50,
  useGlobalProgress = false // Whether to integrate with ModuleProgressContext
}) => {
  // Try to use context if available
  let contextProgress = null;
  try {
    if (useGlobalProgress) {
      contextProgress = useModuleProgress();
    }
  } catch (e) {
    // Context not available, continue with local state
  }
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [responses, setResponses] = useState({});
  const [currentResponse, setCurrentResponse] = useState('');
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [savedNotification, setSavedNotification] = useState(false);

  // Load saved responses from localStorage if autoSave is enabled
  useEffect(() => {
    if (autoSave && typeof window !== 'undefined') {
      const saved = localStorage.getItem('reflection-responses');
      if (saved) {
        setResponses(JSON.parse(saved));
      }
    }
  }, [autoSave]);

  // Load current response when prompt changes
  useEffect(() => {
    const promptId = prompts[currentPromptIndex]?.id;
    setCurrentResponse(responses[promptId] || '');
    setErrors({});
  }, [currentPromptIndex, prompts, responses]);

  // Auto-save responses
  useEffect(() => {
    if (autoSave && typeof window !== 'undefined' && Object.keys(responses).length > 0) {
      localStorage.setItem('reflection-responses', JSON.stringify(responses));
      setSavedNotification(true);
      setTimeout(() => setSavedNotification(false), 2000);
    }
  }, [responses, autoSave]);

  const handleResponseChange = (value) => {
    setCurrentResponse(value);
    setErrors({});
  };

  const validateResponse = () => {
    const prompt = prompts[currentPromptIndex];
    const errors = {};

    if (!allowSkip && currentResponse.trim().length === 0) {
      errors.required = 'A response is required';
    } else if (currentResponse.trim().length > 0 && currentResponse.trim().length < minResponseLength) {
      errors.length = `Please provide a more detailed response (minimum ${minResponseLength} characters)`;
    }

    if (prompt.validation) {
      const validationResult = prompt.validation(currentResponse);
      if (validationResult !== true) {
        errors.custom = validationResult;
      }
    }

    return errors;
  };

  const saveCurrentResponse = () => {
    const errors = validateResponse();
    if (Object.keys(errors).length > 0) {
      setErrors(errors);
      return false;
    }

    const promptId = prompts[currentPromptIndex].id;
    setResponses(prev => ({
      ...prev,
      [promptId]: currentResponse.trim()
    }));

    // Complete task in global context if enabled and response is provided
    if (contextProgress && currentResponse.trim().length > 0) {
      contextProgress.completeTask(promptId);
    }

    if (onSave) {
      onSave(promptId, currentResponse.trim());
    }

    return true;
  };

  const handleNext = () => {
    if (saveCurrentResponse()) {
      if (currentPromptIndex < prompts.length - 1) {
        setCurrentPromptIndex(prev => prev + 1);
      } else if (currentPromptIndex === prompts.length - 1) {
        handleSubmitAll();
      }
    }
  };

  const handlePrevious = () => {
    saveCurrentResponse();
    if (currentPromptIndex > 0) {
      setCurrentPromptIndex(prev => prev - 1);
    }
  };

  const handleSubmitAll = () => {
    if (saveCurrentResponse()) {
      const allResponses = {
        ...responses,
        [prompts[currentPromptIndex].id]: currentResponse.trim()
      };

      // Check if all required prompts have responses
      const missingRequired = prompts
        .filter(p => p.required)
        .find(p => !allResponses[p.id] || allResponses[p.id].length === 0);

      if (missingRequired && !allowSkip) {
        setErrors({
          submit: `Please complete all required prompts. Missing: ${missingRequired.title}`
        });
        return;
      }

      setSubmitted(true);
      if (onSubmit) {
        onSubmit(allResponses);
      }
    }
  };

  const handleExport = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      responses: responses,
      prompts: prompts.map(p => ({ id: p.id, title: p.title, question: p.question }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reflection-responses-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setResponses({});
    setCurrentResponse('');
    setCurrentPromptIndex(0);
    setSubmitted(false);
    setErrors({});
    if (autoSave && typeof window !== 'undefined') {
      localStorage.removeItem('reflection-responses');
    }
  };

  if (prompts.length === 0) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 text-center">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 dark:text-gray-400">No reflection prompts available</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center"
      >
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-2xl font-bold mb-2">Reflections Submitted!</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Thank you for your thoughtful responses. Your reflections have been recorded.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Responses
          </button>
          <button
            onClick={resetAll}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Start Over
          </button>
        </div>
      </motion.div>
    );
  }

  const currentPrompt = prompts[currentPromptIndex];
  const progressPercentage = Math.round(((currentPromptIndex + 1) / prompts.length) * 100);
  const completedCount = Object.keys(responses).length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Reflection & Synthesis
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Take a moment to reflect on what you've discovered
            </p>
          </div>
          {showProgress && (
            <div className="text-right">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Question {currentPromptIndex + 1} of {prompts.length}
              </div>
              <div className="text-xs text-gray-500">
                {completedCount} responses saved
              </div>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {showProgress && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <motion.div
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Current Prompt */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPromptIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Prompt Category */}
            {currentPrompt.category && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md text-xs font-medium mb-3">
                <BookOpen className="w-3 h-3" />
                {currentPrompt.category}
              </div>
            )}

            {/* Prompt Title */}
            <h3 className="text-lg font-semibold mb-2">{currentPrompt.title}</h3>

            {/* Prompt Question */}
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              {currentPrompt.question}
            </p>

            {/* Example Response */}
            {currentPrompt.example && (
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Example response:
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                  "{currentPrompt.example}"
                </p>
              </div>
            )}

            {/* Response Input */}
            <div className="relative">
              <textarea
                value={currentResponse}
                onChange={(e) => handleResponseChange(e.target.value)}
                placeholder="Type your reflection here..."
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none ${
                  errors.required || errors.length || errors.custom
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100`}
                rows={6}
                aria-label={`Response for ${currentPrompt.title}`}
              />
              {currentResponse.length > 0 && (
                <div className="absolute bottom-2 right-2 text-xs text-gray-500">
                  {currentResponse.length} characters
                </div>
              )}
            </div>

            {/* Error Messages */}
            {Object.values(errors).map((error, idx) => (
              <div key={idx} className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            ))}

            {/* Required Indicator */}
            {currentPrompt.required && !allowSkip && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                * This prompt requires a response
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          {/* Navigation */}
          <div className="flex gap-2">
            <button
              onClick={handlePrevious}
              disabled={currentPromptIndex === 0}
              className={`px-4 py-2 rounded-md transition-colors flex items-center gap-2 ${
                currentPromptIndex === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            {allowSkip && (
              <button
                onClick={() => handleNext()}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Skip
              </button>
            )}
          </div>

          {/* Submit/Next */}
          <div className="flex items-center gap-3">
            {savedNotification && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400"
              >
                <Save className="w-3 h-3" />
                Saved
              </motion.div>
            )}
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              {currentPromptIndex === prompts.length - 1 ? (
                <>
                  Submit All
                  <Send className="w-4 h-4" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Example prompts data
export const exampleReflectionPrompts = [
  {
    id: 'reflect-1',
    category: 'Initial Understanding',
    title: 'First Impressions',
    question: 'What was your initial reaction when you first saw the Fair Recruitment AI assurance case? What stood out to you?',
    example: 'I was surprised by how the argument was structured in layers, with each level providing more detail...',
    required: true
  },
  {
    id: 'reflect-2',
    category: 'Structure Analysis',
    title: 'Argument Flow',
    question: 'How does the assurance case build its argument from the main goal down to the evidence? Can you describe the logical flow?',
    example: 'The case starts with a broad fairness claim and systematically breaks it down into specific, measurable aspects...',
    required: true
  },
  {
    id: 'reflect-3',
    category: 'Critical Thinking',
    title: 'Strengths and Weaknesses',
    question: 'What do you think are the strongest parts of this assurance case? Are there any areas that could be improved?',
    required: false
  },
  {
    id: 'reflect-4',
    category: 'Application',
    title: 'Real-World Relevance',
    question: 'How might this type of structured argument be useful in your own work or field? Can you think of a specific application?',
    required: false
  },
  {
    id: 'reflect-5',
    category: 'Synthesis',
    title: 'Key Takeaways',
    question: 'What are the three most important things you learned from exploring this assurance case?',
    required: true,
    validation: (response) => {
      const lines = response.trim().split('\n').filter(l => l.trim().length > 0);
      return lines.length >= 3 || 'Please provide at least three key takeaways';
    }
  }
];

export default ReflectionPrompts;

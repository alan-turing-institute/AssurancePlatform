import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Award,
  AlertCircle,
  ArrowRight,
  Lightbulb,
  Target,
  TrendingUp,
  BarChart,
  Hash
} from 'lucide-react';
import { useModuleProgress } from './ModuleProgressContext';

// Multiple Choice Quiz Component
export const MultipleChoiceQuiz = ({
  questions = [],
  onComplete,
  showFeedback = true,
  allowRetry = true,
  shuffleOptions = false,
  taskId = 'multiple-choice-quiz', // Task ID for progress tracking
  useGlobalProgress = false, // Whether to integrate with ModuleProgressContext
  passThreshold = 60 // Percentage required to pass
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
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);

  const shuffleArray = (array) => {
    if (!shuffleOptions) return array;
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const [shuffledQuestions, setShuffledQuestions] = useState([]);

  useEffect(() => {
    setShuffledQuestions(
      questions.map(q => ({
        ...q,
        options: shuffleArray(q.options)
      }))
    );
  }, [questions, attempts]);

  const handleAnswer = (questionId, optionId) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionId
    }));
  };

  const handleNext = () => {
    if (currentQuestion < shuffledQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      calculateScore();
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const calculateScore = () => {
    let correct = 0;
    shuffledQuestions.forEach(question => {
      if (selectedAnswers[question.id] === question.correctAnswer) {
        correct++;
      }
    });
    setScore(correct);
    setShowResults(true);
    setAttempts(prev => prev + 1);

    const percentage = Math.round((correct / shuffledQuestions.length) * 100);

    // Complete task in global context if passed
    if (contextProgress && percentage >= passThreshold) {
      contextProgress.completeTask(taskId);
    }

    if (onComplete) {
      onComplete({
        score: correct,
        total: shuffledQuestions.length,
        percentage,
        attempts: attempts + 1,
        passed: percentage >= passThreshold
      });
    }
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setSelectedAnswers({});
    setShowResults(false);
    setScore(0);
  };

  if (shuffledQuestions.length === 0) {
    return <div>No questions available</div>;
  }

  if (showResults) {
    const percentage = Math.round((score / shuffledQuestions.length) * 100);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8"
      >
        <div className="text-center">
          {percentage >= 80 ? (
            <Award className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          ) : percentage >= 60 ? (
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          ) : (
            <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          )}

          <h2 className="text-2xl font-bold mb-2">
            {percentage >= 80 ? 'Excellent!' : percentage >= 60 ? 'Good Job!' : 'Keep Learning!'}
          </h2>

          <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
            You scored {score} out of {shuffledQuestions.length} ({percentage}%)
          </p>

          {showFeedback && (
            <div className="text-left max-w-2xl mx-auto mb-6 space-y-4">
              {shuffledQuestions.map((question, idx) => {
                const userAnswer = selectedAnswers[question.id];
                const isCorrect = userAnswer === question.correctAnswer;

                return (
                  <div key={question.id} className="border rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      {isCorrect ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium mb-2">
                          {idx + 1}. {question.question}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Your answer: {question.options.find(o => o.id === userAnswer)?.text || 'Not answered'}
                        </p>
                        {!isCorrect && (
                          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                            Correct answer: {question.options.find(o => o.id === question.correctAnswer)?.text}
                          </p>
                        )}
                        {question.explanation && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 italic">
                            {question.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {allowRetry && (
            <button
              onClick={resetQuiz}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  const question = shuffledQuestions[currentQuestion];
  const hasAnswered = selectedAnswers[question.id] !== undefined;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Question {currentQuestion + 1} of {shuffledQuestions.length}
          </span>
          {attempts > 0 && (
            <span className="text-sm text-gray-500">
              Attempt #{attempts + 1}
            </span>
          )}
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <motion.div
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((currentQuestion + 1) / shuffledQuestions.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          <h3 className="text-lg font-semibold mb-4 flex items-start gap-2">
            <HelpCircle className="w-5 h-5 text-blue-500 mt-0.5" />
            {question.question}
          </h3>

          {/* Options */}
          <div className="space-y-3">
            {question.options.map((option) => {
              const isSelected = selectedAnswers[question.id] === option.id;

              return (
                <button
                  key={option.id}
                  onClick={() => handleAnswer(question.id, option.id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-400'
                    }`}>
                      {isSelected && (
                        <div className="w-full h-full rounded-full bg-white scale-50" />
                      )}
                    </div>
                    <span className="flex-1">{option.text}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-6">
        <button
          onClick={handlePrevious}
          disabled={currentQuestion === 0}
          className={`px-4 py-2 rounded-md flex items-center gap-2 ${
            currentQuestion === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
          }`}
        >
          Previous
        </button>

        <button
          onClick={handleNext}
          disabled={!hasAnswered}
          className={`px-4 py-2 rounded-md flex items-center gap-2 ${
            !hasAnswered
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {currentQuestion === shuffledQuestions.length - 1 ? 'Finish' : 'Next'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// True/False Quiz Component
export const TrueFalseQuiz = ({
  statements = [],
  onComplete,
  showExplanations = true,
  taskId = 'true-false-quiz', // Task ID for progress tracking
  useGlobalProgress = false, // Whether to integrate with ModuleProgressContext
  passThreshold = 60 // Percentage required to pass
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
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState({});
  const [completed, setCompleted] = useState(false);

  const handleAnswer = (statementId, value) => {
    setAnswers(prev => ({ ...prev, [statementId]: value }));
    setRevealed(prev => ({ ...prev, [statementId]: true }));
  };

  const calculateResults = () => {
    const correct = statements.filter(s => answers[s.id] === s.correct).length;
    const percentage = Math.round((correct / statements.length) * 100);
    setCompleted(true);

    // Complete task in global context if passed
    if (contextProgress && percentage >= passThreshold) {
      contextProgress.completeTask(taskId);
    }

    if (onComplete) {
      onComplete({
        score: correct,
        total: statements.length,
        percentage,
        passed: percentage >= passThreshold
      });
    }
  };

  const reset = () => {
    setAnswers({});
    setRevealed({});
    setCompleted(false);
  };

  const allAnswered = statements.every(s => answers[s.id] !== undefined);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4">True or False?</h3>

      <div className="space-y-4">
        {statements.map((statement, idx) => {
          const userAnswer = answers[statement.id];
          const isRevealed = revealed[statement.id];
          const isCorrect = userAnswer === statement.correct;

          return (
            <div key={statement.id} className={`border rounded-lg p-4 ${
              isRevealed && isCorrect ? 'border-green-400 bg-green-50 dark:bg-green-900/20' :
              isRevealed && !isCorrect ? 'border-red-400 bg-red-50 dark:bg-red-900/20' :
              'border-gray-200 dark:border-gray-600'
            }`}>
              <div className="flex items-start gap-3">
                <span className="font-semibold text-gray-500">{idx + 1}.</span>
                <div className="flex-1">
                  <p className="mb-3">{statement.statement}</p>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAnswer(statement.id, true)}
                      disabled={completed}
                      className={`px-4 py-2 rounded-md transition-colors ${
                        userAnswer === true
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      True
                    </button>
                    <button
                      onClick={() => handleAnswer(statement.id, false)}
                      disabled={completed}
                      className={`px-4 py-2 rounded-md transition-colors ${
                        userAnswer === false
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      False
                    </button>
                  </div>

                  <AnimatePresence>
                    {isRevealed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-3 overflow-hidden"
                      >
                        <div className="flex items-start gap-2">
                          {isCorrect ? (
                            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                          )}
                          <div>
                            <p className="text-sm font-medium">
                              {isCorrect ? 'Correct!' : `Incorrect. The answer is ${statement.correct ? 'True' : 'False'}.`}
                            </p>
                            {showExplanations && statement.explanation && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {statement.explanation}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex gap-3">
        {!completed && (
          <button
            onClick={calculateResults}
            disabled={!allAnswered}
            className={`px-6 py-2 rounded-md ${
              allAnswered
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700'
            }`}
          >
            Check Answers
          </button>
        )}
        {completed && (
          <button
            onClick={reset}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};

// Confidence Rating Component
export const ConfidenceRating = ({
  topic,
  onSubmit,
  showFeedback = true,
  taskId = 'confidence-rating', // Task ID for progress tracking
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
  const [rating, setRating] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const levels = [
    { value: 1, label: 'Not confident', color: 'red', icon: XCircle },
    { value: 2, label: 'Slightly confident', color: 'orange', icon: AlertCircle },
    { value: 3, label: 'Moderately confident', color: 'yellow', icon: Target },
    { value: 4, label: 'Confident', color: 'blue', icon: TrendingUp },
    { value: 5, label: 'Very confident', color: 'green', icon: Award }
  ];

  const handleSubmit = () => {
    if (rating) {
      setSubmitted(true);

      // Complete task in global context (any rating counts as complete)
      if (contextProgress) {
        contextProgress.completeTask(taskId);
      }

      if (onSubmit) {
        onSubmit({ topic, rating, label: levels[rating - 1].label });
      }
    }
  };

  const feedback = {
    1: 'That\'s okay! This module is designed to help you build confidence step by step.',
    2: 'You\'re on the right track. Keep exploring and you\'ll gain more confidence.',
    3: 'Good progress! You have a solid foundation to build upon.',
    4: 'Great! You have a strong understanding. Keep refining your knowledge.',
    5: 'Excellent! You\'ve mastered this concept. Consider helping others learn too!'
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold mb-2">How confident do you feel?</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">{topic}</p>

      <div className="flex gap-2 justify-center mb-6">
        {levels.map((level) => {
          const Icon = level.icon;
          const isSelected = rating === level.value;

          return (
            <button
              key={level.value}
              onClick={() => !submitted && setRating(level.value)}
              disabled={submitted}
              className={`flex-1 py-3 px-2 rounded-lg border-2 transition-all ${
                isSelected
                  ? `border-${level.color}-500 bg-${level.color}-50 dark:bg-${level.color}-900/20`
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
              } ${submitted ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
              <Icon className={`w-8 h-8 mx-auto mb-1 ${
                isSelected ? `text-${level.color}-600` : 'text-gray-400'
              }`} />
              <div className="text-xs text-center">{level.label}</div>
            </button>
          );
        })}
      </div>

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!rating}
          className={`w-full px-6 py-2 rounded-md ${
            rating
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700'
          }`}
        >
          Submit Rating
        </button>
      )}

      <AnimatePresence>
        {submitted && showFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
          >
            <div className="flex gap-3">
              <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {feedback[rating]}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Example quiz data
export const exampleQuizData = {
  multipleChoice: [
    {
      id: 'mc-1',
      question: 'What is the top-level element in an assurance case?',
      options: [
        { id: 'a', text: 'Evidence' },
        { id: 'b', text: 'Strategy' },
        { id: 'c', text: 'Goal' },
        { id: 'd', text: 'Context' }
      ],
      correctAnswer: 'c',
      explanation: 'The goal represents the main claim that the assurance case is trying to establish.'
    },
    {
      id: 'mc-2',
      question: 'Which element provides concrete proof for property claims?',
      options: [
        { id: 'a', text: 'Evidence' },
        { id: 'b', text: 'Strategy' },
        { id: 'c', text: 'Goal' },
        { id: 'd', text: 'Context' }
      ],
      correctAnswer: 'a',
      explanation: 'Evidence provides the concrete facts, test results, or documentation that supports property claims.'
    }
  ],
  trueFalse: [
    {
      id: 'tf-1',
      statement: 'Strategies connect goals directly to evidence.',
      correct: false,
      explanation: 'Strategies connect goals to property claims, which are then supported by evidence.'
    },
    {
      id: 'tf-2',
      statement: 'Context defines the boundaries and assumptions of the assurance case.',
      correct: true,
      explanation: 'Context elements explicitly state the scope, assumptions, and conditions under which the goal is claimed to be satisfied.'
    }
  ]
};

export default { MultipleChoiceQuiz, TrueFalseQuiz, ConfidenceRating };

/**
 * TaskRegistry - System for registering and managing module tasks
 *
 * Allows modules to define tasks that integrate with the progress tracker
 */

/**
 * Task types supported by the system
 */
export const TaskType = {
  CHECKPOINT: 'checkpoint',       // Manual checkpoint at section end
  EXPLORATION: 'exploration',     // Exploration checklist item
  QUIZ: 'quiz',                   // Quiz completion
  REFLECTION: 'reflection',       // Reflection prompt response
  CONFIDENCE: 'confidence',       // Confidence rating submission
  READ: 'read',                   // Reading/content consumption
  INTERACT: 'interact',           // General interaction (e.g., reveal, click)
  CUSTOM: 'custom'                // Custom task type
};

/**
 * Task status values
 */
export const TaskStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  SKIPPED: 'skipped'
};

/**
 * Create a task definition
 * @param {object} config - Task configuration
 * @returns {object} Task definition
 */
export const createTask = ({
  id,
  title,
  description = '',
  type = TaskType.CHECKPOINT,
  page = null,
  section = null,
  autoTrack = false,
  required = true,
  learningObjective = null,
  order = 0
}) => {
  return {
    id,
    title,
    description,
    type,
    page,              // Which page this task belongs to (e.g., 'exploration')
    section,           // Which section within the page (for anchoring)
    autoTrack,         // Whether completion is tracked automatically
    required,          // Whether task is required for module completion
    learningObjective, // Associated learning objective
    order,             // Display order
    status: TaskStatus.PENDING,
    completed: false,
    completedAt: null
  };
};

/**
 * Example task definitions for first-sip module
 */
export const firstSipTasks = [
  // Page 1: Exploration
  createTask({
    id: 'find-main-goal',
    title: 'Find the main goal',
    description: 'Click on the green node at the top. What is the system claiming?',
    type: TaskType.EXPLORATION,
    page: 'exploration',
    autoTrack: true,
    learningObjective: 'Identify the top-level goal in an assurance case',
    order: 1
  }),
  createTask({
    id: 'discover-strategies',
    title: 'Discover the three strategies',
    description: 'Find the purple nodes. How does the case break down "fairness"?',
    type: TaskType.EXPLORATION,
    page: 'exploration',
    autoTrack: true,
    learningObjective: 'Understand how strategies decompose high-level goals',
    order: 2
  }),
  createTask({
    id: 'follow-evidence',
    title: 'Follow claims to evidence',
    description: 'Pick one strategy and trace its argument to the evidence.',
    type: TaskType.EXPLORATION,
    page: 'exploration',
    autoTrack: true,
    learningObjective: 'Trace the argument chain from goals to evidence',
    order: 3
  }),
  createTask({
    id: 'identify-context',
    title: 'Identify the context',
    description: 'Find the grey nodes. What assumptions and boundaries are being made explicit?',
    type: TaskType.EXPLORATION,
    page: 'exploration',
    autoTrack: true,
    learningObjective: 'Recognize the role of context in scoping assurance cases',
    order: 4
  }),
  createTask({
    id: 'explore-connections',
    title: 'Explore the connections',
    description: 'How do different parts relate to each other? Can you see the logical flow?',
    type: TaskType.EXPLORATION,
    page: 'exploration',
    autoTrack: true,
    learningObjective: 'Understand the logical relationships between case elements',
    order: 5
  }),

  // Page 2: Reflection
  createTask({
    id: 'first-impressions',
    title: 'Share first impressions',
    description: 'Reflect on your initial reaction to the Fair Recruitment AI case',
    type: TaskType.REFLECTION,
    page: 'reflection',
    autoTrack: true,
    required: true,
    learningObjective: 'Articulate initial understanding and observations',
    order: 6
  }),
  createTask({
    id: 'argument-flow',
    title: 'Analyze argument flow',
    description: 'Describe how the case builds its argument from goals to evidence',
    type: TaskType.REFLECTION,
    page: 'reflection',
    autoTrack: true,
    required: true,
    learningObjective: 'Explain the logical structure of an assurance argument',
    order: 7
  }),
  createTask({
    id: 'strengths-weaknesses',
    title: 'Identify strengths and weaknesses',
    description: 'Evaluate what aspects were convincing or incomplete',
    type: TaskType.REFLECTION,
    page: 'reflection',
    autoTrack: true,
    required: false,
    learningObjective: 'Critically evaluate assurance arguments',
    order: 8
  }),

  // Page 3: Assessment
  createTask({
    id: 'multiple-choice-quiz',
    title: 'Complete knowledge check',
    description: 'Answer questions about the Fair Recruitment AI case',
    type: TaskType.QUIZ,
    page: 'assessment',
    autoTrack: true,
    required: true,
    learningObjective: 'Demonstrate understanding of case structure',
    order: 9
  }),
  createTask({
    id: 'true-false-quiz',
    title: 'True or False questions',
    description: 'Verify understanding of key concepts',
    type: TaskType.QUIZ,
    page: 'assessment',
    autoTrack: true,
    required: true,
    learningObjective: 'Confirm grasp of assurance case principles',
    order: 10
  }),
  createTask({
    id: 'confidence-rating',
    title: 'Rate your confidence',
    description: 'Assess your confidence in understanding assurance cases',
    type: TaskType.CONFIDENCE,
    page: 'assessment',
    autoTrack: true,
    required: false,
    learningObjective: 'Self-assess comprehension level',
    order: 11
  })
];

/**
 * Get tasks for a specific page
 * @param {array} tasks - All tasks
 * @param {string} page - Page identifier
 * @returns {array} Filtered tasks
 */
export const getTasksForPage = (tasks, page) => {
  return tasks.filter(task => task.page === page).sort((a, b) => a.order - b.order);
};

/**
 * Get the next incomplete task
 * @param {array} tasks - All tasks
 * @returns {object|null} Next task or null
 */
export const getNextTask = (tasks) => {
  return tasks.find(task => task.status !== TaskStatus.COMPLETED) || null;
};

/**
 * Get required tasks
 * @param {array} tasks - All tasks
 * @returns {array} Required tasks
 */
export const getRequiredTasks = (tasks) => {
  return tasks.filter(task => task.required);
};

/**
 * Check if module is complete
 * @param {array} tasks - All tasks
 * @returns {boolean} Whether all required tasks are complete
 */
export const isModuleComplete = (tasks) => {
  const requiredTasks = getRequiredTasks(tasks);
  return requiredTasks.every(task => task.status === TaskStatus.COMPLETED);
};

export default {
  TaskType,
  TaskStatus,
  createTask,
  firstSipTasks,
  getTasksForPage,
  getNextTask,
  getRequiredTasks,
  isModuleComplete
};

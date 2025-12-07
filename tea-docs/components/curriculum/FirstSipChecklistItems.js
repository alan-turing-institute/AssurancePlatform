// Checklist items for the First Sip module
export const firstSipChecklistItems = [
  {
    id: 'find-goal',
    title: 'Find the main goal',
    description: 'Click on the green node at the top. What is the system claiming?',
    hint: 'The goal states the overall claim about fairness in AI recruitment.'
  },
  {
    id: 'explore-strategies',
    title: 'Discover the three strategies',
    description: 'Find the purple nodes. How does the case break down "fairness"?',
    hint: 'Each strategy represents a different approach to ensuring fairness: bias detection, transparency, and monitoring.'
  },
  {
    id: 'follow-claims',
    title: 'Follow claims to evidence',
    description: 'Pick one strategy and trace its argument to the evidence. What makes it convincing?',
    hint: 'Click on a strategy node to reveal the claims (orange) and evidence (cyan) that support it.'
  },
  {
    id: 'identify-context',
    title: 'Identify the context',
    description: 'Find the grey nodes. What assumptions and boundaries are being made explicit?',
    hint: 'Context nodes provide important information about scope and assumptions, like regulatory requirements or technical constraints.'
  },
  {
    id: 'explore-connections',
    title: 'Explore the connections',
    description: 'How do different parts relate to each other? Can you see the logical flow?',
    hint: 'Each connection represents a logical relationship. Evidence supports claims, claims support strategies, and strategies support the goal.'
  }
];

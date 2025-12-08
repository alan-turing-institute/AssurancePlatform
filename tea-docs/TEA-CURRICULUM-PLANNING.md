# TEA Skills Curriculum Planning Document

**Version:** 1.0
**Date:** November 2025
**Purpose:** Curriculum design and content specifications

---

## Document Purpose

This document specifies **what to teach** and **how to structure learning** in the TEA skills curriculum. It focuses on:
- Learning objectives and outcomes
- Pedagogical approach
- Module content specifications
- Assessment frameworks

For implementation timeline and resource planning, see `TEA-DEVELOPER-ROADMAP.md`.
For platform features and technical documentation needs, see `TEA-TECHNICAL-DOCUMENTATION-PLANNING.md`.

---

## Table of Contents

1. [Curriculum Philosophy](#curriculum-philosophy)
2. [Learning Progression Model](#learning-progression-model)
3. [TEA Trainee Level](#tea-trainee-level)
4. [TEA Specialist Level](#tea-specialist-level)
5. [TEA Expert Level](#tea-expert-level)
6. [Assessment & Validation](#assessment--validation)
7. [Content Development Guidelines](#content-development-guidelines)
8. [Appendix: Platform Features Mapping](#appendix-platform-features-mapping)

---

## Curriculum Philosophy

### Core Principles

The TEA curriculum is built on the following educational principles:

**1. Scaffolded Learning**
- Start with foundational concepts before moving to application
- Each level builds on skills from the previous level
- Provide support structures that gradually release responsibility to learners

**2. Practice-Based Learning**
- Learning happens through doing, not just reading
- Every module includes hands-on exercises
- Real-world scenarios and case studies are central

**3. Critical Reflection**
- Encourage questioning and analysis
- Support iterative thinking and revision
- Emphasize the "why" behind practices

**4. Community of Practice**
- Learning is social and collaborative
- Peer feedback and shared knowledge
- Connection to broader assurance ecosystem

**5. Ethical Awareness**
- Forefront ethical considerations throughout
- Multiple perspectives and stakeholder voices
- Values-based decision making

---

## Learning Progression Model

### Three-Level Framework

```
┌─────────────────────────────────────────────────────────┐
│  TEA EXPERT                                             │
│  • Organizational leadership                            │
│  • Method innovation                                    │
│  • Community contribution                               │
│  • Standards development                                │
└─────────────────────────────────────────────────────────┘
                        ▲
                        │
┌─────────────────────────────────────────────────────────┐
│  TEA SPECIALIST                                         │
│  • Production-ready cases                               │
│  • Domain expertise application                         │
│  • Advanced platform features                           │
│  • Team leadership                                      │
└─────────────────────────────────────────────────────────┘
                        ▲
                        │
┌─────────────────────────────────────────────────────────┐
│  TEA TRAINEE                                            │
│  • Foundational concepts                                │
│  • Platform basics                                      │
│  • Simple case building                                 │
│  • Collaboration fundamentals                           │
└─────────────────────────────────────────────────────────┘
```

### Learning Dimensions

Each level develops across these dimensions:

| Dimension | Trainee | Specialist | Expert |
|-----------|---------|------------|--------|
| **Knowledge** | Recall & Understanding | Application & Analysis | Synthesis & Evaluation |
| **Skills** | Basic platform use | Advanced techniques | Innovation & teaching |
| **Context** | Individual practice | Team/organizational | Community/ecosystem |
| **Complexity** | Simple cases | Production systems | Novel challenges |
| **Autonomy** | Guided practice | Self-directed | Leadership |

### Cross-Cutting Themes

All levels address:
- **Ethical Reflection**: Values, stakeholders, trade-offs
- **Evidence Quality**: Evaluation, selection, sufficiency
- **Communication**: Clarity, transparency, accessibility
- **Iteration**: Continuous improvement, feedback integration

---

## TEA Trainee Level

**Target Audience:** Newcomers to trustworthy and ethical assurance

**Prerequisites:** None (basic understanding of AI/data science helpful but not required)

**Time Commitment:** 6-10 hours total

---

### Overall Learning Objectives

By completing the TEA Trainee level, learners will be able to:

1. **Explain** the core concepts of argument-based assurance and its role in building justified trust
2. **Identify** and describe the five core elements of an assurance case (goals, claims, strategies, evidence, context)
3. **Create** basic assurance cases using the TEA platform
4. **Navigate** the TEA platform interface and use essential features
5. **Apply** critical thinking to evaluate argument quality and identify gaps
6. **Collaborate** with others on shared assurance cases
7. **Engage** with the TEA community and broader assurance ecosystem

---

### Module 1: Your First Sip of TEA 🍵

**Status:** Requires complete redesign (CRITICAL - blocks Module 2)
**Estimated Time:** 30-40 minutes

**Learning Philosophy:** Experience before explanation. Learners explore a pre-built, exemplary assurance case through interactive discovery before learning formal concepts or terminology. This aligns with the "first sip" metaphor - tasting tea someone else has brewed before learning to brew your own.

**Pedagogical Approach:**
- **Concrete before abstract** - See a real case before learning definitions
- **Discovery learning** - Learners actively construct knowledge through guided exploration
- **Worked examples** - Seeing an expert-level case provides mental model for future work
- **Experiential learning cycle** - Concrete experience → Reflection → Conceptualization → Application (Module 2)

**Learning Objectives:**
1. **Experience** what a complete assurance case looks and feels like
2. **Discover** argument structure and flow through guided exploration
3. **Intuitively understand** element types and relationships before learning names
4. **Develop** mental model of trustworthy assurance
5. **Build curiosity** about how to create assurance cases

**Content Structure:**

#### 1.1 Welcome & First Impressions (5 min)
- Brief introduction: "Before you brew, taste what good TEA is like"
- Open interactive case viewer: **"Fair Recruitment AI System"**
- Initial observation: "What do you notice about how this is organized?"
- Visual pattern recognition without terminology
- Curiosity building: "What is this trying to demonstrate?"

**Interactive Component:** Custom React component - Case viewer with initial state, minimal UI

#### 1.2 Following the Argument (10 min)
- Guided interactive walkthrough from top goal to evidence
- Progressive disclosure with discovery questions:
  - Click goal: "This is what they're trying to assure. What questions would YOU ask?"
  - Click strategy: "Notice how it breaks the big claim into parts..."
  - Click property claim: "What evidence would you need to believe this?"
  - Click evidence: "Here's the proof. Does it support the claim above?"
- Learner discovers relationships through exploration, not explanation

**Interactive Component:** Clickable path highlighting, progressive tooltips, discovery questions

#### 1.3 Independent Exploration (10 min)
- Guided exploration checklist with prompts:
  - "Find elements with different shapes - what patterns do you notice?"
  - "Follow a different path from top to bottom"
  - "What role do the rounded rectangles play?"
  - "Can you find where the argument might be weak?"
- Self-paced discovery with optional hints

**Interactive Component:** Interactive checklist, hover states, optional hint system

#### 1.4 Reflection & Synthesis (10 min)
- Guided reflection prompts:
  - "What made this argument convincing?"
  - "What would happen if evidence was missing?"
  - "How did the structure help you follow the reasoning?"
- Synthesize observations into patterns
- Connect to ideas of trust and justification (light touch)

**Interactive Component:** Reflection form with structured prompts, possibly shareable responses

#### 1.5 Naming What You Discovered (5 min)
- **NOW** introduce formal terminology, grounded in their experience:
  - Goals (the rectangles at top): "Remember the 'fair recruitment' claim?"
  - Property Claims (rectangles): "The specific claims you followed down"
  - Strategies (parallelograms): "How the argument was organized into parts"
  - Evidence (cylinders): "The proof you found at the bottom"
  - Context (rounded rectangles): "Information that scoped the claims"
- Brief definitions that make sense because they've seen them in action
- Support and context links: "The connections you followed"

**Interactive Component:** Animated reveals that highlight elements as they're named

**Transition to Module 2:**
"You've tasted what a well-brewed assurance case is like. In the next module, you'll learn to use the TEA platform to brew your own, building cases just like this one."

**Exemplary Case Requirements:**

**Single Case Used Throughout Trainee Level:**
- **Topic:** Fair Recruitment AI System (addressing bias and discrimination)
- **Rationale:**
  - Universally relatable (everyone understands hiring)
  - Important ethical considerations (fairness, bias)
  - Concrete enough for beginners to grasp
  - Rich enough to demonstrate all element types
- **Quality:** Professional, polished, complete
- **Complexity:** Medium (8-12 total elements)
- **Structure:**
  - 1 top-level goal about fairness
  - 2-3 strategies decomposing fairness
  - 4-6 property claims about specific aspects
  - 3-4 evidence items grounding claims
  - 1-2 context elements scoping the system
- **Format:** Importable JSON, viewable in platform

**Required Interactive Components:**

**Custom React Components to Develop:**
1. **Interactive Case Viewer** - Simplified, guided version of main platform
   - Progressive disclosure
   - Clickable elements with tooltips
   - Guided path highlighting
   - Discovery question overlays

2. **Exploration Checklist** - Interactive task list with hints
   - Checkbox completion tracking
   - Optional hint reveals
   - Progress feedback

3. **Reflection Prompts** - Structured reflection capture
   - Text input for thoughts
   - Guided question progression
   - Optional: Shareable reflections

4. **Concept Reveal Animation** - Animated element highlighting
   - Coordinated highlighting as concepts named
   - Click to see definition
   - Review mode to revisit

5. **Mini-Quiz Components** (for later use)
   - Multiple choice
   - Drag-and-drop element matching
   - True/false with explanations
   - Interactive confidence rating

**Assessment:**
- **Formative:** Discovery questions throughout (self-check)
- **Reflection:** Written reflection on what made the case convincing
- **Concept Check:** Simple matching quiz - match elements to roles (optional)
- **No formal grading** - Focus on discovery and experience

**What Happens to Original Module 1 Content:**

The theoretical content (car dealership analogy, formal definitions, Tim Kelly quote, etc.) is valuable but repositioned:

**Option 1 - Distributed Just-in-Time:**
- Move car dealership analogy to Module 2 introduction
- Integrate theoretical content where relevant in later modules
- Tim Kelly quote in Module 3 (evidence quality)

**Option 2 - Optional Background Reading:**
- Create "Background: Assurance Theory" in shared resources
- Link as "For those who want theoretical background..."
- Available but not required

**Option 3 - Quick Reference:**
- Condensed theoretical content in quick reference guide
- Glossary with formal definitions
- Available for lookup during later modules

**Recommended Approach:** Combination of 1 and 3
- Just-in-time integration of key concepts in Modules 2-3
- Quick reference guide for formal definitions and theory
- Original car dealership analogy could open Module 2

**Technical Requirements:**
- Custom React components embedded in Docusaurus
- Exemplary case JSON file in repository
- Interactive components should work offline
- Accessibility: Keyboard navigation, screen reader support
- Mobile-responsive design

**Development Notes:**
- This module blocks Module 2 development (Module 2 references the exemplary case)
- Interactive components can be developed incrementally
- Start with basic viewer, add interactivity progressively
- Component library can be reused in later modules

---

### Module 2: Brewing Your Own TEA 🫖

**Status:** To be developed (HIGHEST PRIORITY after Module 1 redesign)
**Estimated Time:** 90-120 minutes

**Learning Philosophy:** Guided practice building on concrete experience. Learners use the TEA platform to recreate elements of the Fair Recruitment case from Module 1, then build their own variation.

**Connection to Module 1:**
Opening: "In Module 1, you explored the Fair Recruitment AI assurance case. You discovered how goals, claims, strategies, and evidence work together to build trust. Now you'll learn to use the TEA platform to brew your own cases just like that one."

**Learning Objectives:**
1. Create and configure a new assurance case in the TEA platform
2. Navigate the platform interface and understand key features
3. Add and edit all element types (goals, claims, strategies, evidence, context)
4. Use the visual graph interface to build argument structure
5. Understand automatic saving and the sandbox feature
6. Save, export, and share basic assurance cases

**Content Structure:**

#### 2.1 Getting Started (15 min)
- Account creation and login
- Dashboard overview
- Understanding the interface layout
- **Reference:** "This is where you'll find the Fair Recruitment case you explored in Module 1"

**Learning Activity:** Follow-along tutorial to create account and explore dashboard

#### 2.2 Creating Your First Case (15 min)
- Case creation walkthrough
- Naming conventions
- Understanding permissions

**Learning Activity:** Create your first (blank) assurance case

#### 2.3 Understanding the Canvas (20 min)
- ReactFlow visual workspace
- Navigation controls (zoom, pan, fit view)
- Layout options
- Node types and visual representation
- **Reference:** "Remember the shapes you discovered in Module 1? Now you'll see how they appear in the editing interface."

**Learning Activity:** Open the Fair Recruitment case, practice navigation

#### 2.4 Building Case Structure (40 min)
- Adding a top-level goal
- Adding strategies
- Adding property claims
- Adding evidence
- Adding context
- Understanding element fields and properties

**Learning Activity:** Recreate a simplified version of the Fair Recruitment case

**Guided Exercise:**
```
Scenario: Fair Recruitment AI (Simplified Version)
Goal: "The recruitment AI system treats all candidates fairly"

Step-by-step guide to build (recreating Module 1 case structure):
- 1 goal about fairness
- 2 strategies (e.g., "Argue over data quality" and "Argue over decision-making process")
- 4 property claims (specific fairness aspects)
- 3 evidence items grounding key claims
- 1 context (defining the recruitment scope)

Throughout: "Remember when you clicked on the strategy in Module 1?
Now you're creating one yourself..."
```

#### 2.5 Editing and Managing (15 min)
- Node editing interface
- The sandbox feature (orphaned elements)
- Deleting and reattaching elements

**Learning Activity:** Edit and refine your weather case

#### 2.6 Platform Features (15 min)
- Action bar features (focus, screenshot, notes, resources)
- Reset identifiers
- Screenshot capture

**Learning Activity:** Explore each action bar feature

#### 2.7 Saving and Sharing (10 min)
- Automatic saving
- JSON export
- Basic sharing (introduction to permissions)

**Learning Activity:** Export your case as JSON

#### 2.8 Practice Exercise (20 min)
**Independent Exercise:**
Build your own variation on the Fair Recruitment case:
- **Option 1:** Different aspect of fairness (e.g., accessibility for disabled candidates)
- **Option 2:** Different domain but similar structure (e.g., fair loan approval AI)
- **Option 3:** Extend the Fair Recruitment case with additional claims and evidence

Template structure provided matching Fair Recruitment case architecture.

**Assessment:**
- Self-assessment checklist (Can you...?)
- Compare your case to Module 1 exemplary case
- Quiz on platform features (10 questions)

**Required Media:**
- 8-10 video demonstrations (2-4 min each) showing Fair Recruitment case creation
- 15-20 annotated screenshots using Fair Recruitment case
- Exemplary case JSON file (Fair Recruitment AI)
- Quick reference card (PDF, 1-2 pages)

**Platform Features Covered:**
- `CaseCreateModal`, `Flow`, `ActionButtons`, `NodeCreate`, `NodeEdit`, `ShareModal`, `CaseNotes`
- All core data models: `AssuranceCase`, `TopLevelNormativeGoal`, `PropertyClaim`, `Strategy`, `Evidence`, `Context`

**Notes:**
- All demonstrations use the Fair Recruitment case for consistency
- Learners already familiar with this case from Module 1
- Reduces cognitive load by maintaining single exemplar throughout

---

### Module 3: Letting the TEA Steep 🔴

**Status:** To be developed
**Estimated Time:** 90-120 minutes

**Learning Philosophy:** Deep understanding through critical analysis. Learners develop critical thinking skills by analyzing the Fair Recruitment case from Module 1, identifying what makes it strong and where it could be improved.

**Connection to Previous Modules:**
Opening: "You've explored the Fair Recruitment case (Module 1) and learned to build your own (Module 2). Now let's dive deeper: What makes an assurance case truly convincing? How do we know when it's good enough?"

**Learning Objectives:**
1. Engage in critical reflection about goal formulation and claim adequacy
2. Develop well-justified arguments with appropriate evidence
3. Identify gaps and weaknesses in assurance arguments
4. Iterate and refine assurance cases based on reflection
5. Apply ethical reasoning to assurance case development
6. Evaluate evidence quality using established criteria

**Content Structure:**

#### 3.1 Critical Reflection (20 min)
- Questioning your arguments
- Common pitfalls (circular reasoning, insufficient evidence, over-claiming)
- What makes a claim sufficient?
- Identifying hidden assumptions
- **Reference:** "Return to the Fair Recruitment case. Why was it convincing? What questions remain unanswered?"

**Learning Activity:** Analyze Fair Recruitment case critically - identify 3 strengths and 3 potential weaknesses

#### 3.2 Deliberation & Justification (20 min)
- Types of justification (empirical, normative, procedural)
- Linking evidence to claims convincingly
- Understanding burden of proof
- Using assumptions and justifications in strategies

**Learning Activity:** Strengthen weak arguments in example case

#### 3.3 Evidence Quality (25 min)
- Criteria for good evidence (relevance, reliability, sufficiency)
- Types of evidence:
  - Technical (testing, benchmarks, metrics)
  - Process (audits, documentation, certifications)
  - Stakeholder (surveys, interviews, user studies)
- Role of standards in evidence

**Learning Activity:** Evaluate evidence quality in 3 example cases

#### 3.4 Iterative Development (15 min)
- Treating cases as living documents
- When to revise goals vs. claims vs. evidence
- Tracking changes over time
- Responding to feedback

**Learning Activity:** Revision exercise with feedback scenario

#### 3.5 Context Matters (15 min)
- How context shapes and constrains claims
- Documenting deployment vs. development context
- Multiple contexts for complex systems

**Case Study:** Compare same claim in different contexts

#### 3.6 Ethical Reflection (20 min)
- Recognizing value-laden claims
- Different stakeholder perspectives
- Whose values are represented?
- Balancing trade-offs
- Documenting ethical considerations

**Learning Activity:** Ethical reflection exercise on fairness case

#### 3.7 Gap Analysis (15 min)
- Identifying missing evidence
- Under-supported claims
- Missing context
- Incomplete strategies
- Introduction to argument patterns

**Learning Activity:** Conduct gap analysis on your own Module 2 case

#### 3.8 Practice Exercises (20 min)

**Exercise 1: Critique the Exemplar**
Conduct comprehensive gap analysis of the Fair Recruitment case:
- Identify 5+ potential weaknesses or gaps
- Suggest specific improvements
- Consider: What evidence is missing? What claims need stronger support?

**Exercise 2: Refinement**
Refine your Fair Recruitment variation from Module 2:
- Add evidence quality justifications to your evidence elements
- Identify and explicitly document assumptions in strategies
- Add missing context that would constrain your claims
- Fill identified gaps based on critique skills developed

**Assessment:**
- Gap analysis submission (Fair Recruitment case)
- Reflection essay (500 words): "What makes assurance trustworthy?"
- Peer review exercise (review one other learner's case)

**Required Media:**
- 3-5 video case studies (5-8 min each) analyzing Fair Recruitment case
- Interactive gap analysis exercise using Fair Recruitment
- Evidence quality rubric applied to recruitment scenario
- Reflection templates

**Notes:**
- Continued use of Fair Recruitment case reinforces learning
- Learners develop deep familiarity with single exemplar
- Can identify increasingly subtle issues through repeated exposure

---

### Module 4: Drinking TEA with Others 🔴

**Status:** To be developed
**Estimated Time:** 60-90 minutes

**Learning Objectives:**
1. Collaborate effectively with team members on shared assurance cases
2. Use platform collaboration features (comments, real-time editing, permissions)
3. Provide constructive feedback on assurance cases
4. Share knowledge with the TEA community
5. Understand the broader assurance ecosystem

**Content Structure:**

#### 4.1 Real-Time Collaboration (15 min)
- Active users indicator
- WebSocket-based real-time updates
- Working simultaneously on same case
- Conflict resolution

**Learning Activity:** Join a shared case, observe changes in real-time

#### 4.2 Sharing & Permissions (20 min)
- Permission levels: View, Review, Edit, Manage
- Sharing workflow (inviting by email)
- Group-based sharing
- Managing team access

**Learning Activity:** Share your case with different permission levels

#### 4.3 Comments & Discussions (15 min)
- Adding comments to elements
- Threaded replies
- Using review permissions effectively
- Addressing reviewer feedback

**Learning Activity:** Provide structured comments on example case

#### 4.4 Team & Group Management (10 min)
- Creating teams
- Adding members
- Group-based permissions
- Organizational workflows

**Learning Activity:** Set up a project team

#### 4.5 Published Cases & Community (15 min)
- Creating case studies
- Publishing vs. keeping private
- Exploring the Discover section
- Learning from community examples

**Case Study:** Analyze 2-3 published case studies

#### 4.6 Community Engagement (10 min)
- GitHub discussions
- Community support channels
- Contribution opportunities
- Knowledge sharing practices

**Learning Activity:** Explore community resources

#### 4.7 The Assurance Ecosystem (10 min)
- Understanding the broader landscape
- Different actors and roles
- How TEA fits into the ecosystem
- Leveraging external resources and standards

**Cross-reference:** Standalone guide "Understanding the Assurance Ecosystem"

#### 4.8 Team Project Exercise (30 min)

**Collaborative Exercise:**
Scenario: "Trustworthy Chatbot for Mental Health Support"

Working in teams of 3-4:
- Assign roles (Lead, Reviewer, Contributors)
- Co-develop assurance case
- Use all collaboration features
- Conduct peer review
- Provide structured feedback

**Assessment:**
- Team case submission
- Peer feedback quality (rubric-based)
- Individual reflection on collaboration
- Quiz on collaboration features

**Required Media:**
- 4-6 video demonstrations (3-5 min each)
- Permissions matrix diagram
- Peer review rubric
- Team collaboration case study

**Platform Features Covered:**
- `WebSocketComponent`, `ActiveUsersList`, `ShareModal`, `Comment`, `EAPGroup`, `CaseStudy`

---

### Trainee Capstone Project

**Purpose:** Demonstrate integration of all Trainee-level skills

**Requirements:**
1. **Complete Assurance Case**
   - Minimum 1 goal, 2 strategies, 5 property claims, 3 evidence items
   - Demonstrates critical thinking and gap analysis
   - Well-justified with appropriate evidence
   - Clear context definition

2. **Collaboration**
   - Share case with at least one reviewer
   - Address reviewer feedback
   - Document revisions made

3. **Reflection Document** (750-1000 words)
   - What did you learn?
   - What challenges did you face?
   - How did your thinking evolve?
   - How might you apply TEA in your work?

**Suggested Topics:**
- Fair recruitment AI system
- Secure telehealth platform
- Sustainable supply chain tracking
- Accessible educational technology
- (Or learner's own domain)

**Assessment Rubric:**
- Argument structure and completeness (30%)
- Evidence quality and sufficiency (25%)
- Critical reflection demonstrated (20%)
- Collaboration and feedback integration (15%)
- Written reflection depth (10%)

**Completion Criteria:** Score ≥70% on rubric

---

## TEA Specialist Level

**Target Audience:** Completed TEA Trainee or equivalent experience

**Prerequisites:**
- Ability to build basic assurance cases
- Familiarity with TEA platform
- Understanding of core concepts

**Time Commitment:** 15-25 hours total

---

### Overall Learning Objectives

By completing the TEA Specialist level, learners will be able to:

1. **Build** comprehensive, production-ready assurance cases for complex systems
2. **Apply** domain-specific knowledge and standards to assurance cases
3. **Utilize** advanced platform features and integrations
4. **Lead** assurance case development within projects and organizations
5. **Manage** evidence systematically across the project lifecycle
6. **Facilitate** stakeholder engagement and co-development processes
7. **Contribute** meaningful examples and patterns to the TEA community
8. **Integrate** assurance practices with development workflows

---

### Module 1: Advanced Argument Patterns

**Estimated Time:** 2-3 hours

**Learning Objectives:**
- Understand and apply established argument patterns (GSN, CAE)
- Recognize when to use specific patterns for different assurance goals
- Adapt and customize patterns for context-specific needs
- Create reusable pattern templates

**Content Overview:**
- Goal Structuring Notation (GSN) patterns in depth
- Claims-Arguments-Evidence (CAE) framework
- Safety case patterns (AMLAS guidance for ML systems)
- Fairness, security, explainability patterns
- Pattern catalogs and when to use them
- Adapting vs. blindly following patterns

**Learning Activities:**
- Pattern matching exercise
- Apply 3 different patterns to same scenario
- Critique pattern application in real cases
- Develop custom pattern for specific domain

**Assessment:**
- Pattern application exercise
- Create and document custom pattern

**Related Standards:** ISO/IEC 15026, DEF STAN 00-56, GSN Community Standard

---

### Module 2: Domain-Specific Assurance

**Estimated Time:** 3-4 hours

**Learning Objectives:**
- Apply TEA methodology to specific domains
- Understand domain-specific regulatory requirements
- Use domain-appropriate evidence types
- Address sector-specific ethical considerations

**Content Overview:**

**Healthcare & Medical AI**
- Clinical safety standards (DCB0129/0160)
- Patient safety and clinical efficacy
- Health data privacy (GDPR)
- FDA and MHRA regulations

**Autonomous Systems**
- Safety-critical system assurance
- Environmental interaction complexity
- AMLAS guidance application
- Scenario-based testing

**Financial Services**
- Fairness and anti-discrimination
- Explainability for credit decisions
- Regulatory compliance
- Audit trails

**Public Sector & Government**
- Accountability and transparency
- Public trust and legitimacy
- Algorithmic impact assessments

**Learning Activities:**
- Domain-specific case study analysis (2 per domain)
- Build case in your chosen domain
- Regulatory compliance checklist exercise
- Cross-domain comparison

**Assessment:**
- Domain-specific case development
- Regulatory compliance analysis

---

### Module 3: Evidence Management & Quality Assurance

**Estimated Time:** 2-3 hours

**Learning Objectives:**
- Establish evidence management processes
- Evaluate evidence quality systematically
- Manage evidence lifecycle and versioning
- Address evidence gaps and limitations
- Integrate diverse evidence types

**Content Overview:**
- Evidence hierarchies and quality criteria
- Technical evidence (metrics, testing, benchmarking)
- Process evidence (documentation, certifications, audits)
- Stakeholder evidence (user studies, consultations)
- Evidence traceability and provenance
- Dealing with negative evidence
- Uncertainty quantification

**Learning Activities:**
- Evidence quality audit exercise
- Evidence gap analysis
- Build evidence management plan
- Integrate conflicting evidence

**Assessment:**
- Evidence audit of complex case
- Evidence management plan for project

---

### Module 4: Stakeholder Engagement & Co-Development

**Estimated Time:** 2-3 hours

**Learning Objectives:**
- Facilitate co-development workshops
- Engage diverse stakeholders in assurance process
- Translate stakeholder concerns into claims
- Manage conflicting values and priorities
- Document stakeholder input

**Content Overview:**
- Stakeholder mapping and analysis
- Workshop facilitation techniques
- Using the "Co-Developing an Assurance Case" guide
- Eliciting tacit knowledge
- Values-based design and negotiation
- Power dynamics and representation
- Accessibility for diverse stakeholders

**Learning Activities:**
- Stakeholder mapping exercise
- Facilitate mock workshop
- Values elicitation practice
- Conflict resolution scenario

**Assessment:**
- Workshop facilitation plan
- Stakeholder engagement case study

**Cross-reference:** Hands-on guide "Co-Developing an Assurance Case"

---

### Module 5: Integration with Development Lifecycles

**Estimated Time:** 2-3 hours

**Learning Objectives:**
- Integrate assurance with project lifecycle
- Implement continuous assurance practices
- Use version control for assurance cases
- Align assurance with Agile/DevOps
- Automate evidence collection

**Content Overview:**
- Assurance in Agile development
- DevOps and MLOps integration
- CI/CD pipeline integration
- Version control strategies
- Linking cases to code and datasets
- Change impact analysis
- Living documentation

**Learning Activities:**
- Map assurance to Agile workflow
- Design CI/CD integration
- Version control exercise
- Automated evidence pipeline

**Assessment:**
- Integration plan for development workflow
- Automation strategy document

---

### Module 6: Advanced Platform Features & Customization

**Estimated Time:** 2-3 hours

**Learning Objectives:**
- Use advanced platform configuration
- Leverage API for custom workflows
- Implement custom integrations
- Troubleshoot issues
- Optimize for large cases

**Content Overview:**
- Platform API deep dive
- JSON structure and schema
- Custom export formats
- Batch operations and scripting
- Performance optimization
- Advanced permission configurations
- Backup and recovery

**Learning Activities:**
- API integration exercise
- Custom export script
- Performance optimization case
- Troubleshooting scenarios

**Assessment:**
- Custom integration implementation
- API usage documentation

**Technical Documentation Reference:** API Reference, Developer Guide

---

### Module 7: Quality Review & Assessment

**Estimated Time:** 2 hours

**Learning Objectives:**
- Conduct systematic case reviews
- Apply quality criteria
- Provide structured feedback
- Identify anti-patterns
- Assess argument sufficiency

**Content Overview:**
- Review methodologies
- Quality assessment criteria
- Common anti-patterns
- Peer review best practices
- Self-assessment techniques
- Independent verification

**Learning Activities:**
- Conduct formal case review
- Use quality checklist
- Identify anti-patterns exercise
- Self-assessment practice

**Assessment:**
- Formal review submission
- Quality assessment report

---

### Module 8: Contributing to the Community

**Estimated Time:** 1-2 hours

**Learning Objectives:**
- Create reusable templates and patterns
- Publish high-quality case studies
- Write effective documentation
- Mentor and support others
- Contribute to platform development

**Content Overview:**
- Writing case study descriptions
- Creating useful templates
- Documentation best practices
- Community contribution guidelines
- Open source contribution
- Knowledge sharing platforms

**Learning Activities:**
- Publish case study
- Create template
- Write tutorial
- Mentor peer exercise

**Assessment:**
- Published contribution (case study or template)
- Community engagement evidence

---

### Specialist Capstone Project

**Purpose:** Demonstrate production-level competency

**Requirements:**
1. **Production-Ready Assurance Case**
   - For real or realistic system in specific domain
   - Domain-specific considerations addressed
   - Comprehensive evidence documented
   - Stakeholder engagement process documented

2. **Quality Review**
   - Self-assessment against quality criteria
   - External review by Specialist or Expert
   - All feedback addressed

3. **Case Study Publication**
   - Publish on TEA platform
   - Clear description and documentation
   - Reusable elements identified

4. **Reflection Document** (1500-2000 words)
   - Process and methodology used
   - Challenges and solutions
   - Domain-specific considerations
   - Lessons learned
   - Future improvements

**Assessment Rubric:**
- Production readiness (25%)
- Domain expertise application (20%)
- Evidence quality and management (20%)
- Stakeholder engagement (15%)
- Quality and completeness (15%)
- Community contribution value (5%)

**Completion Criteria:** Score ≥75% on rubric + published case study

---

## TEA Expert Level

**Target Audience:** Completed TEA Specialist or significant professional experience

**Prerequisites:**
- Production-level assurance case development
- Domain expertise
- Team leadership experience

**Time Commitment:** 12-20 hours total

---

### Overall Learning Objectives

By completing the TEA Expert level, learners will be able to:

1. **Establish** organizational assurance practices and governance
2. **Develop** novel argument patterns and methodologies
3. **Conduct** research on assurance methods
4. **Lead** large-scale, multi-team assurance initiatives
5. **Contribute** to standards development and policy
6. **Teach** and mentor others in assurance practices
7. **Advance** the field through innovation and thought leadership

---

### Module 1: Organizational Assurance Strategy

**Estimated Time:** 2-3 hours

**Learning Objectives:**
- Design organizational assurance frameworks
- Establish assurance governance structures
- Integrate assurance with risk management
- Develop internal standards and policies
- Measure assurance program effectiveness

**Content Overview:**
- Assurance maturity models
- Governance structures for responsible AI
- Policy development and implementation
- Team structures and roles
- Metrics and KPIs
- Budget and resource planning
- Executive communication
- Risk-based prioritization

**Learning Activities:**
- Maturity assessment of organization
- Design governance structure
- Develop organizational policy
- Create executive briefing

**Assessment:**
- Organizational assurance strategy document

---

### Module 2: Research Methods for Assurance

**Estimated Time:** 2-3 hours

**Learning Objectives:**
- Conduct empirical research on assurance
- Evaluate method effectiveness
- Contribute to academic literature
- Design usability studies
- Analyze assurance quality at scale

**Content Overview:**
- Research design for assurance
- Qualitative methods (interviews, ethnography)
- Quantitative methods (surveys, experiments)
- Case study methodology
- Systematic literature reviews
- Publishing and dissemination
- Research ethics

**Learning Activities:**
- Design research study
- Literature review exercise
- Data collection planning
- Academic writing practice

**Assessment:**
- Research proposal or paper outline

---

### Module 3: Advanced Argument Theory & Logic

**Estimated Time:** 2-3 hours

**Learning Objectives:**
- Apply formal logic to arguments
- Understand argument evaluation frameworks
- Identify fallacies and errors
- Use argument analysis techniques
- Develop rigorous evaluation methods

**Content Overview:**
- Formal logic and argument structure
- Argumentation schemes (Walton)
- Toulmin's model
- Bayesian reasoning in assurance
- Probabilistic arguments
- Formal verification methods
- Argument strength and confidence
- Computational argumentation

**Learning Activities:**
- Formal analysis exercises
- Logic problem solving
- Argument strength evaluation
- Probabilistic reasoning practice

**Assessment:**
- Formal argument analysis

---

### Module 4: Innovation & Novel Applications

**Estimated Time:** 2-3 hours

**Learning Objectives:**
- Apply TEA to emerging technologies
- Develop new argument patterns
- Adapt TEA for novel domains
- Research method extensions
- Publish innovations

**Content Overview:**
- Assurance for emerging AI (LLMs, generative AI, embodied AI)
- Novel domains (climate tech, social media, education, infrastructure)
- Methodological innovations
- Tool and platform enhancements
- Research opportunities

**Learning Activities:**
- Apply TEA to emerging tech
- Develop novel pattern
- Innovation proposal
- Gap analysis of field

**Assessment:**
- Innovation case study or proposal

---

### Module 5: Standards Development & Policy

**Estimated Time:** 2 hours

**Learning Objectives:**
- Contribute to standards development
- Engage with regulatory bodies
- Develop organizational standards
- Participate in policy consultations
- Bridge research and policy

**Content Overview:**
- Standards development process
- Technical committee participation
- Policy consultation and response
- Regulatory engagement
- Harmonization across jurisdictions
- International collaboration
- Impact assessment

**Learning Activities:**
- Analyze existing standards
- Draft standard contribution
- Policy response exercise
- Stakeholder engagement

**Assessment:**
- Standards or policy contribution

**Cross-reference:** Standalone guide "Standards and their role in assurance"

---

### Module 6: Teaching & Mentorship

**Estimated Time:** 2 hours

**Learning Objectives:**
- Design assurance training programs
- Mentor practitioners effectively
- Facilitate advanced workshops
- Develop educational materials
- Assess learner competency

**Content Overview:**
- Adult learning principles
- Curriculum design
- Workshop facilitation at scale
- Mentorship techniques
- Creating learning materials
- Assessment and evaluation
- Communities of practice
- Train-the-trainer

**Learning Activities:**
- Design training module
- Mentor peer
- Facilitate workshop
- Create teaching materials

**Assessment:**
- Teaching materials development
- Mentorship case study

---

### Module 7: Community Leadership

**Estimated Time:** 1-2 hours

**Learning Objectives:**
- Lead community initiatives
- Organize events and conferences
- Build collaborative networks
- Contribute to open-source
- Foster inclusive communities

**Content Overview:**
- Community building strategies
- Event organization
- Open-source governance
- Inclusive leadership
- Conflict resolution
- Sustainability of efforts
- Measuring impact

**Learning Activities:**
- Community initiative proposal
- Event planning
- Inclusion audit
- Governance design

**Assessment:**
- Community leadership plan

---

### Expert Portfolio

**Purpose:** Demonstrate thought leadership and field advancement

**Requirements:**

**1. Major Contribution** (choose one):
- Published academic paper on assurance
- Novel argument pattern with validation
- Organizational framework implementation
- Significant platform feature contribution
- Standards development participation
- Community initiative leadership

**2. Community Leadership** (choose two):
- Mentorship of Specialist-level practitioners (documented)
- Workshop or training delivery (materials + feedback)
- Published case study or teaching materials
- Active community participation (contributions documented)

**3. Vision Essay** (2000-3000 words):
- Future of assurance (your perspective)
- Personal practice philosophy
- Field advancement recommendations
- Reflection on Expert journey

**Assessment Criteria:**
- Significance of contribution (40%)
- Community leadership (30%)
- Vision and thought leadership (20%)
- Quality of reflection (10%)

**Completion:** Expert review panel evaluates portfolio

---

## Assessment & Validation

### Assessment Philosophy

Assessment in the TEA curriculum serves multiple purposes:
- **Formative**: Support learning through feedback and reflection
- **Summative**: Validate achievement of learning objectives
- **Self-directed**: Enable learners to assess their own progress

### Assessment Types

**1. Self-Assessment**
- Reflection questions
- Self-check quizzes
- Checklists and rubrics

**2. Practical Demonstrations**
- Building assurance cases
- Platform usage exercises
- Real-world applications

**3. Peer Assessment**
- Peer review of cases
- Collaborative projects
- Community feedback

**4. Portfolio-Based**
- Capstone projects
- Collection of work
- Documented contributions

### Success Criteria by Level

**Trainee:**
- Can independently create basic assurance cases
- Understands all core elements
- Uses essential platform features
- Demonstrates critical thinking

**Specialist:**
- Creates production-ready cases
- Applies domain knowledge
- Uses advanced features
- Leads teams
- Contributes to community

**Expert:**
- Establishes organizational practices
- Contributes to method development
- Publishes or presents work
- Mentors others
- Advances the field

---

## Content Development Guidelines

### Writing Style

**Clarity:**
- Use plain language
- Define technical terms
- Break complex ideas into steps
- Use examples liberally

**Accessibility:**
- Alt text for all images
- Transcripts for videos
- Multiple formats (text, visual, interactive)
- Consider diverse learning styles

**Engagement:**
- Start with concrete examples
- Use narratives and scenarios
- Include reflection prompts
- Encourage active learning

### Module Template

Each module should include:

```markdown
---
[Frontmatter with metadata]
---

# Module Title

## Learning Objectives
- Specific, measurable objectives

## Introduction
- Why this matters
- Connection to previous learning

## Content Sections
- Theory and concepts
- Examples and case studies
- Learning activities
- Reflection prompts

## Summary
- Key takeaways
- Self-check questions

## Practice Exercise
- Hands-on application
- Clear instructions

## Assessment
- How learners demonstrate mastery

## Resources
- Further reading
- Related materials

## What's Next
- Preview of next module
```

### Media Guidelines

**Videos:**
- 2-7 minutes maximum per video
- Clear audio and visuals
- Captions and transcripts
- Focused on one concept

**Screenshots:**
- High resolution
- Annotated with labels
- Descriptive captions
- Alt text provided

**Diagrams:**
- Simple and clear
- Consistent style
- Accessible color palette
- Text descriptions

**Interactive:**
- Clear instructions
- Immediate feedback
- Optional (enhance, don't require)

---

## Appendix: Platform Features Mapping

### Core Elements → Platform Components

| Curriculum Element | Platform Model | Component | Module(s) |
|-------------------|----------------|-----------|-----------|
| Goal Claims | `TopLevelNormativeGoal` | `NodeEdit`, `NodeCreate` | Trainee M2 |
| Property Claims | `PropertyClaim` | `NodeEdit`, `NodeCreate` | Trainee M2, M3 |
| Strategies | `Strategy` | `NodeEdit`, `NodeCreate` | Trainee M2, M3 |
| Evidence | `Evidence` | `NodeEdit`, `NodeCreate` | Trainee M2, M3 |
| Context | `Context` | `NodeEdit`, `NodeCreate` | Trainee M2, M3 |
| Collaboration | `Comment`, `WebSocket` | `CommentForm`, `WebSocketComponent` | Trainee M4 |
| Sharing | `EAPGroup`, permissions | `ShareModal` | Trainee M4 |
| Case Studies | `CaseStudy` | Case study components | Trainee M4 |

### Feature Coverage by Module

**Trainee Module 2:**
- Account management
- Case creation and editing
- All element types
- Visual canvas
- Basic sharing
- Export/import

**Trainee Module 3:**
- Critical analysis
- Evidence evaluation
- Iteration and refinement
- (Uses same platform features, focuses on thinking)

**Trainee Module 4:**
- Real-time collaboration
- Comments and discussions
- Permissions
- Groups
- Publishing

**Specialist Modules:**
- Advanced permissions
- API usage
- Custom integrations
- Batch operations
- Performance optimization

**Expert Modules:**
- (Less platform-specific, more conceptual and methodological)

---

## Document Maintenance

**Owner:** Curriculum Development Lead
**Review Frequency:** Quarterly or when platform changes
**Version History:**
- v1.0 (Nov 2025): Initial curriculum planning document

**Related Documents:**
- `TEA-DEVELOPER-ROADMAP.md` - Implementation timeline and resources
- `TEA-TECHNICAL-DOCUMENTATION-PLANNING.md` - Technical documentation needs

---

## Conclusion

This curriculum is designed to develop competent practitioners of trustworthy and ethical assurance across three progressive levels. By emphasizing practical application, critical reflection, and community engagement, learners will gain both the skills and mindset needed to build convincing, trustworthy assurance cases for AI and data-driven systems.

The modular structure allows flexibility in delivery while maintaining clear learning progression. Each module builds skills incrementally, with assessment validating achievement before advancement.

**Next Steps:** See `TEA-DEVELOPER-ROADMAP.md` for implementation planning.

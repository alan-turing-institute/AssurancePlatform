# Explainable Student Learning Assessment System

![Student Learning Assessment Hero Image](/img/case-studies/student-learning-assessment.jpeg)

| Field | Details |
|-------|---------|
| **Domain** | Education |
| **Assurance Goal** | Explainability |

## Overview

The Oakwood Multi-Academy Trust has deployed an AI-powered learning analytics platform across its 15 secondary schools to identify student learning gaps and recommend targeted interventions. The system analyses student interactions with digital learning resources, formative assessments, and homework submissions to build personalised models of each student's knowledge state.

Given the sensitive nature of educational assessment and the potential impact on student pathways, the Trust has commissioned an assurance case to demonstrate that the system provides explanations that teachers, students, and parents can understand and act upon effectively.

## System Description

### What the System Does

The Trust's Student Learning Assessment System (SLAS) supports personalised learning by:

- Tracking student interactions with digital learning platforms and resources (e.g. days used, modules completed, score patterns)
- Analysing formative assessment responses to identify knowledge gaps
- Building a dynamic model of each student's mastery of curriculum concepts
- Generating personalised recommendations for practice activities and resources
- Providing dashboards for teachers, students, and parents with actionable insights

### How It Works

The system operates continuously throughout the school year:

1. **Data Collection**: Captures student interactions with learning platforms (e.g. time on task, response patterns, resource usage) and assessment responses
2. **Knowledge Modelling**: A Bayesian knowledge tracing model (i.e. a probabilistic method that estimates the likelihood a student has mastered each concept based on their response history) updates *mastery estimates* for each concept in the curriculum
3. **Gap Identification**: Compares current mastery estimates against expected progression to identify concerning gaps
4. **Recommendation Generation**: Suggests specific activities, resources, or topics for focused attention
5. **Dashboard Presentation**: Presents insights through role-appropriate dashboards with explanations

### Key Technical Details

| Aspect | Details |
|--------|---------|
| **Model Architecture** | Bayesian Knowledge Tracing (probabilistic mastery estimation) with deep learning extensions; knowledge graph (a structured map of how curriculum concepts relate to and build upon each other) with 2,500+ concepts |
| **Training Data** | 3 years of anonymised learning interaction data from pilot schools; curriculum mapping validated by subject specialists |
| **Input Features** | Response correctness, response time, hint usage, resource engagement patterns, assessment scores, practice frequency |
| **Output** | Mastery probability per concept (0-1, where higher means more likely mastered), learning gap alerts, personalised recommendations, progress trajectories |
| **Update Frequency** | Real-time mastery updates; weekly dashboard refreshes; termly progress reports |
| **Explainability Methods** | Concept-level mastery visualisation (showing which topics are strong or weak), natural language gap descriptions, recommendation rationales, progress narratives |

### Deployment Context

- **Coverage**: 15 secondary schools (Years 7-11), approximately 20,000 students
- **Subjects**: Currently deployed for Mathematics and Science (Physics, Chemistry and Biology); English pilot beginning next term
- **Integration**: Works alongside existing learning management systems and assessment platforms
- **Data Volume**: Analyses approximately 50,000 student interactions weekly
- **Operational Since**: September 2024

## Stakeholders

| Stakeholder | Interest | Concern |
|-------------|----------|---------|
| **Students** | Understand their learning progress and how to improve | May feel surveilled or labelled; need agency over their learning |
| **Teachers** | Identify struggling students and target support effectively | Must understand AI insights to integrate with professional judgement; should not feel their role as teacher is being devalued |
| **Parents/Carers** | Understand child's progress and how to support at home | Need accessible explanations without educational jargon |
| **SENCOs (Special Educational Needs Coordinators)** | Identify students needing additional support | Require reliable early warning with actionable information |
| **School Leaders** | Improve educational outcomes across the trust | Balance innovation with safeguarding and data protection |
| **Ofsted** | Ensure appropriate use of technology in education | Scrutiny of AI use in assessment and student tracking |

## Regulatory Context

The system operates within several regulatory frameworks:

- **UK GDPR and Data Protection Act 2018**: Special protections for children's data; data protection impact assessment required
- **Children's Code (Age Appropriate Design Code)**: While schools processing data for education are exempt, EdTech providers acting as data controllers may still be covered by ICO requirements
- **Education (Independent School Standards) Regulations 2014**: Standards for academies and independent schools regarding pupil records and data handling
- **Equality Act 2010**: Ensuring the system doesn't disadvantage students with protected characteristics
- **Ofsted Education Inspection Framework**: Expectations around appropriate use of assessment data
- **DfE EdTech Guidance**: Department for Education guidance on safe and effective educational technology

## Explainability Considerations

Several aspects of this system require careful attention to explainability:

### Multiple Audience Needs

The same underlying analysis must be communicated differently to:
- **Teachers**: Detailed concept-level information to inform lesson planning and intervention
- **Students**: Motivating, growth-oriented explanations that support self-directed learning
- **Parents**: Accessible summaries that enable supportive involvement without technical jargon

### Avoiding Harmful Labels

Explanations must be carefully framed to avoid labelling students in ways that become self-fulfilling prophecies. "Struggling with algebra" has different implications than "ready to build stronger foundations in algebra."

### Actionability

Explanations are only valuable if they lead to appropriate action. Telling a teacher that "Student X has a 0.3 mastery probability for quadratic equations" is less useful than "Student X would benefit from revisiting factorisation before attempting quadratics."

### Uncertainty and Confidence

The system's estimates are probabilistic and uncertain, especially for new students or rarely-practiced concepts. Explanations must convey appropriate confidence without appearing unreliable.

### Student Agency

Students should understand enough about how the system works to engage with it productively, including understanding that it's a tool to support their learning, not a definitive judgement of their ability.

## Assurance Focus

The assurance case should demonstrate that:

> **The Student Learning Assessment System provides explanations that enable teachers, students, and parents to understand learning progress and take appropriate supportive action.**

### Deliberative Prompts

- What are the risks of giving students, teachers, and parents different views of the same underlying assessment?
- How do you explain uncertainty to a 12-year-old without either confusing them or undermining the system's usefulness?
- When does personalised feedback become limiting rather than empowering for a student?
- Who should be able to see a student's learning profile, and what rights should students have over their own data?
- How might well-intentioned explanations inadvertently narrow a student's sense of their own potential?

## Suggested Strategies

When developing your assurance case, consider these potential approaches:

### Strategy 1: Audience-Tailored Explanations

Develop distinct explanation formats that meet the different needs of teachers (professional decision support), students (learning motivation), and parents (supportive involvement) while maintaining consistency in the underlying assessment.

### Strategy 2: Actionable Insights

Ensure every piece of feedback is connected to concrete next steps, so that identifying a learning gap naturally leads to understanding what to do about it.

### Strategy 3: Constructive Framing and Student Agency

Design explanation language and visualisations that emphasise growth potential and next steps rather than deficits, while ensuring students understand how the system works and have meaningful ways to engage with, question, or contest their assessments.

### Strategy 4: Appropriate Uncertainty Communication

Develop ways of conveying confidence and uncertainty that are appropriate for each audience, avoiding both false precision and unhelpful vagueness.

## Recommended Techniques for Evidence

The following techniques from the [TEA Techniques library](https://alan-turing-institute.github.io/tea-techniques/techniques/) may be useful when gathering evidence for this assurance case:

- [SHapley Additive exPlanations (SHAP)](https://alan-turing-institute.github.io/tea-techniques/techniques/shapley-additive-explanations/) - Quantify how much each input feature (e.g., assessment responses, time on task) contributes to a student's mastery estimate
- [Partial Dependence Plots](https://alan-turing-institute.github.io/tea-techniques/techniques/partial-dependence-plots/) - Visualise how changes in specific features affect predicted mastery, helping teachers understand the model's reasoning
- [Conformal Prediction](https://alan-turing-institute.github.io/tea-techniques/techniques/conformal-prediction/) - Generate statistically valid confidence intervals for mastery estimates, enabling appropriate communication of uncertainty to different audiences

# Case Study Template

> **Note**: This file is a template for creating new case studies. It uses a `.md`
> extension and underscore prefix so that Nextra does not include it in the
> documentation build. When creating a new case study, copy this file, rename it
> to `your-case-study-name.mdx`, and fill in each section following the guidance
> below. Remember to also add the new case study to the `_meta.ts` file and the
> `index.mdx` listing.

---

## Frontmatter

Replace the placeholder values below. The frontmatter is required for Nextra to
correctly index and display the page.

```yaml
---
title: "Full Title of the Case Study"
# ^ A descriptive title, typically: "[Assurance Goal] [System Name]"
#   e.g. "Explainable Diabetic Retinopathy Screening System"
#   e.g. "Equitable Flood Risk Assessment System"

description: "A case study exploring [assurance goal] for [brief system description]"
# ^ One sentence summarising the case study for search engines and link previews.

sidebar_label: "Short Label"
# ^ A concise label for sidebar navigation (2-4 words).
#   e.g. "Diabetic Retinopathy", "Flood Risk Assessment"

sidebar_position: N
# ^ Numeric position in the sidebar. Check existing case studies for the
#   next available number.

tags:
  - case-studies
  - domain-tag        # e.g. healthcare, agriculture, education, environment
  - assurance-goal    # e.g. fairness, explainability, transparency
  - AI
# ^ Include "case-studies" and "AI" as standard tags. Add the domain and
#   assurance goal as additional tags. Add further tags as relevant
#   (e.g. "genai", "data-governance", "pharmaceutical").
---
```

---

## Page Title and Summary Table

Start the page with the full title as an H1 heading, a hero image, and a
quick-reference summary table.

```markdown
# Full Title of the Case Study

![Case Study Hero Image](/images/case-studies/your-case-study-name.jpeg)

| Field | Details |
|-------|---------|
| **Domain** | e.g. Healthcare, Agriculture, Education |
| **Assurance Goal** | e.g. Fairness, Explainability, Transparency |
```

> **Hero image**: Place the image in `/public/images/case-studies/`. Use a
> descriptive filename matching the case study slug. JPEG or PNG, ideally
> 1200x630px or similar landscape ratio.

---

## Overview

Provide 2-3 paragraphs introducing the case study scenario. This section should:

1. **Introduce the organisation** — who has deployed or is using the system?
   Give a realistic name and context (e.g. "The Thames Valley Water Authority",
   "AgriSure Insurance Ltd").

2. **Describe the system at a high level** — what does it do, at what scale?
   Include key numbers (e.g. "processing approximately 15,000 claims annually",
   "serving 2.8 million residents").

3. **Explain why assurance is needed** — what prompted the assurance case? This
   is typically a concern raised by stakeholders, regulators, or an internal
   audit. Frame it as a concrete trigger, not an abstract need.

> **Example opening**: "The NHS Midlands Diabetic Eye Screening Programme has
> deployed an AI-powered system to assist in screening retinal images for signs
> of diabetic retinopathy..."

---

## System Description

### What the System Does

A bulleted list of the system's key capabilities. Aim for 4-6 bullets that
capture what the system does from a user's perspective.

> **Example bullets**:
> - Analysing pre-event and post-event satellite imagery to detect crop health changes
> - Generating preliminary payout recommendations based on policy terms
> - Flagging complex cases for human adjuster review

### How It Works

A numbered step-by-step description of the system's processing pipeline, written
for a non-technical audience. Each step should have a **bold label** followed by
a colon and a plain-English description. Where technical terms are unavoidable,
include a brief parenthetical explanation.

> **Example step**: "**Record Retrieval**: The system accesses the patient's
> integrated care record, pulling data from GP records, hospital episodes,
> community care, mental health services, and social care where relevant"

Aim for 4-7 steps covering the full pipeline from input to output.

### Key Technical Details

A table summarising the technical specification. Use the following columns and
rows as a starting point — adjust rows as appropriate for the system.

```markdown
| Aspect | Details |
|--------|---------|
| **Model Architecture** | e.g. "EfficientNet-B4 with attention mechanism" — include a brief parenthetical explaining what the architecture does |
| **Training Data** | Volume, time span, and source of training data |
| **Input Features** | Key inputs the model uses (list the most important ones) |
| **Output** | What the system produces (predictions, scores, recommendations, etc.) |
| **Performance** | Key metrics if available (sensitivity, specificity, MAE, AUC, etc.) |
| **Explainability Methods** | How the system explains its decisions (e.g. SHAP, Grad-CAM, attention maps) — link to TEA Techniques where applicable |
| **Validation** | How the system is validated (prospective clinical validation, back-testing, external audit, etc.) |
```

> **Tip**: When mentioning technical terms (e.g. "convolutional neural network",
> "SHAP values"), include a brief parenthetical explanation for non-specialist
> readers. For example: "SHAP values (a method for explaining which factors most
> influenced a prediction)".

### Deployment Context

A bulleted list of key deployment facts. Typically includes:

- **Coverage**: Geographic or institutional scope
- **Volume**: Scale of usage (queries/day, cases/year, etc.)
- **Users**: Who interacts with the system
- **Human Oversight**: What human review is in place
- **Operational Since**: When the system went live

---

## Stakeholders

A table identifying the key parties with an interest in the system's assurance.
Each row should include the stakeholder group, their primary interest, and their
main concern.

```markdown
| Stakeholder | Interest | Concern |
|-------------|----------|---------|
| **Group Name** | What they want from the system | What worries them |
```

Aim for 5-8 stakeholder groups. Consider including:

- **Direct users** of the system (e.g. clinicians, teachers, farmers)
- **People affected** by the system's outputs (e.g. patients, students, residents)
- **The deploying organisation's leadership**
- **Regulators and oversight bodies**
- **Advocacy groups or representatives** of affected communities
- **Industry bodies or professional associations**

> **Tip**: The "Concern" column should highlight specific worries, not generic
> statements. "May lack resources to challenge assessments" is better than
> "wants fair treatment".

---

## Regulatory Context

A bulleted list of the regulatory frameworks relevant to the system. For each,
include the full name and a brief note on how it applies to this case study.

> **Example**:
> - **UK GDPR and Data Protection Act 2018**: Special category health data
>   processing requirements; data protection impact assessment required
> - **Equality Act 2010**: Prohibits discrimination in service provision,
>   relevant if system outputs correlate with protected characteristics

Aim for 4-7 regulatory frameworks. Common ones to consider:

- UK GDPR / Data Protection Act 2018
- Equality Act 2010
- Sector-specific regulation (e.g. FCA, MHRA, Ofsted, Environment Agency)
- Professional standards or codes of practice
- EU AI Act (if relevant for EU market access or as an influential framework)

---

## [Assurance Goal] Considerations

> **Section title**: Replace `[Assurance Goal]` with the specific goal, e.g.
> "Fairness Considerations", "Explainability Considerations", or "Transparency
> Considerations".

This section identifies 3-6 specific concerns related to the assurance goal.
Each concern should be an H3 subsection with 1-2 paragraphs explaining why it
matters in this context.

The concerns should be specific to this system and domain — not generic
statements about AI ethics. They should help readers understand the concrete
challenges that the assurance case needs to address.

> **Example concern headings** (for a fairness case study):
> - ### Farm Size Bias
> - ### Satellite Resolution Limitations
> - ### Crop Type Representation
> - ### Geographic Variation
> - ### Technology Access
>
> **Example concern headings** (for an explainability case study):
> - ### Clinical Decision Support
> - ### Multiple Audiences
> - ### Uncertainty Quantification and Communication
> - ### Feature Attribution Accuracy
> - ### Edge Cases and Limitations

---

## Assurance Focus

A brief introduction followed by a blockquote stating the assurance goal as a
single, clear sentence. This is the central claim that the assurance case should
support.

```markdown
The assurance case should demonstrate that:

> **[System Name] [does what] across [scope], with [key quality attributes].**
```

> **Examples**:
> - "The Crop Damage Assessment System fairly evaluates insurance claims across
>   all farmers, without systematic disadvantage based on farm size, crop type,
>   geographic location, or technology access."
> - "The Diabetic Retinopathy Screening System provides explanations that enable
>   qualified graders to understand, verify, and appropriately act on AI
>   recommendations for patient care."

### Deliberative Prompts

4-6 open-ended questions for reflection and discussion. These should:

- Probe genuine tensions and trade-offs (not questions with obvious answers)
- Be specific to this case study's context
- Encourage critical thinking about the assurance goal
- Be suitable for group discussion in a workshop setting

> **Example prompts**:
> - "What does 'fair' mean in the context of automated insurance claim
>   assessment, and who gets to define it?"
> - "How should uncertainty be communicated without undermining trust in the
>   system or encouraging graders to ignore it?"

---

## Suggested Strategies

3-6 strategies that readers could pursue when developing their assurance case.
Each strategy should be an H3 subsection with a **bold strategy name** and a
1-2 sentence description of the approach.

Strategies should be:

- **Concrete enough** to guide action, but **open enough** to allow creative
  approaches
- **Distinct** from each other (covering different aspects of the assurance goal)
- **Relevant** to the specific system and domain

> **Example strategy names**:
> - Equitable Accuracy
> - Data Quality Parity
> - Accessible Appeals
> - Ongoing Fairness Monitoring
> - Layered Transparency
> - Audience-Appropriate Explanations

---

## Recommended Techniques for Evidence

A curated list of 3-5 techniques from the TEA Techniques library that are
relevant to gathering evidence for this assurance case. Each entry should include
a link and a brief explanation of how the technique applies to this case study.

```markdown
The following techniques from the [TEA Techniques library](https://alan-turing-institute.github.io/tea-techniques/techniques/) may be useful when gathering evidence for this assurance case:

- [Technique Name](https://alan-turing-institute.github.io/tea-techniques/techniques/technique-slug/) - Brief explanation of how this technique applies to this specific case study
```

> **Tip**: Don't just list techniques generically — explain *why* each technique
> is relevant to *this* case study. For example: "Evaluate whether damage
> assessments and payout rates are consistent across farm sizes, crop types, and
> geographic regions" is better than "Assess demographic parity".

Browse the full library at:
https://alan-turing-institute.github.io/tea-techniques/techniques/

---

## Further Reading

A bulleted list of 1-5 links to related resources. Always include:

```markdown
- [Understanding the Assurance Ecosystem](../../standalone/assurance-ecosystem)
```

Optionally add links to:

- Other relevant pages within the TEA Platform curriculum
- External standards, guidance documents, or regulations specific to the domain
- Key academic or policy references

> **Note**: Use relative links for internal pages and full URLs for external
> resources.

---

## Checklist Before Publishing

Before submitting your new case study, verify:

- [ ] File is named `your-case-study-slug.mdx` (lowercase, hyphenated)
- [ ] Frontmatter is complete with title, description, sidebar_label, sidebar_position, and tags
- [ ] Hero image exists at `/public/images/case-studies/your-case-study-slug.{jpeg,png}`
- [ ] The case study is added to `_meta.ts` in this directory
- [ ] The case study is added to the table and domain listing in `index.mdx`
- [ ] All technical terms include brief parenthetical explanations
- [ ] British English is used throughout (e.g. "analyse", "behaviour", "colour")
- [ ] TEA Techniques links are valid and point to the correct technique pages
- [ ] Internal links use relative paths (e.g. `../../standalone/assurance-ecosystem`)
- [ ] The assurance focus statement is a single, clear sentence in a blockquote
- [ ] Deliberative prompts probe genuine tensions, not questions with obvious answers

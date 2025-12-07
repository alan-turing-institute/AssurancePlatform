# TEA Glossary

**Purpose:** This glossary provides definitions for key terms and concepts used throughout the TEA curriculum and platform.

**Usage:** Terms are organized alphabetically for quick reference. Click on letter headings to navigate.

**Last Updated:** November 2025

---
## Quick Navigation

[A](#a) | [B](#b) | [C](#c) | [D](#d) | [E](#e) | [F](#f) | [G](#g) | [H](#h) | [I](#i) | [J](#j) | [K](#k) | [L](#l) | [M](#m) | [N](#n) | [O](#o) | [P](#p) | [Q](#q) | [R](#r) | [S](#s) | [T](#t) | [U](#u) | [V](#v) | [W](#w) | [X](#x) | [Y](#y) | [Z](#z)

---
## A

### Argument

A structured set of claims and evidence that collectively support a conclusion. In the context of TEA, an argument demonstrates how a top-level goal claim is justified through property claims and evidence.

**See also:** [Argument-Based Assurance](#argument-based-assurance), [Assurance Case](#assurance-case)

### Argument-Based Assurance

A methodology for building and presenting a reasoned and justified argument for the truth of some top-level claim (goal claim). The TEA platform implements argument-based assurance through structured visual representations.

**See also:** [Assurance Case](#assurance-case), [TEA](#trustworthy-and-ethical-assurance-tea)

### Assurance

The process of building trust by clearly communicating the rationale behind why a decision or set of actions were taken. Assurance involves providing evidence to help someone understand and evaluate the trustworthiness of claims being made about a system, service, product, or technology.

### Assurance Case

A document or structured argument that presents reasoning and evidence to demonstrate that a system, service, or product meets specific goals or requirements. An assurance case contains claims, strategies, evidence, and context organized in a logical structure.

**Types include:** Safety case, fairness case, security case, explainability case.

**See also:** [Argument-Based Assurance](#argument-based-assurance)

### Assurance Ecosystem

The broader landscape of actors, organizations, standards bodies, regulators, and communities involved in developing, evaluating, and maintaining assurance practices for technology systems.

**Related Module:** [Understanding the Assurance Ecosystem](../standalone/assurance-ecosystem.md)

---
## B

### Benchmarking

The process of evaluating system performance against established standards, metrics, or comparison points. Used as evidence in assurance cases to demonstrate that performance requirements have been met.

**See also:** [Evidence](#evidence), [Testing](#testing)

---
## C

### Claim

A proposition or statement that may be true or false and requires justification. In TEA, claims include goal claims and property claims that form the structure of an assurance argument.

**See also:** [Goal Claim](#goal-claim), [Property Claim](#property-claim)

### Context

Information that constrains or scopes the applicability of claims in an assurance case. Context elements define the boundaries within which claims are valid (e.g., specific use environment, user population, or deployment scenario).

**Types include:** Context of use, system description, deployment environment.

**See also:** [Context Link](#context-link)

### Context Link

A connection between a context element and a claim (goal or property) or strategy. Context links indicate that the contextual information constrains or scopes the element it is linked to.

**See also:** [Context](#context), [Support Link](#support-link)

---
## D

### Deliberation

The process of careful consideration, reflection, and reasoning when developing assurance cases. Deliberation involves examining assumptions, considering alternative perspectives, and ensuring claims are well-justified.

**See also:** [Critical Reflection](#critical-reflection)

---
## E

### Evidence

Information, data, or artifacts that provide justification for claims made in an assurance case. Evidence grounds the argument and demonstrates that claims are valid and trustworthy.

**Types include:**

* **Technical Evidence:** Test results, metrics, benchmarks, performance data
* **Process Evidence:** Audits, certifications, documentation, compliance records
* **Stakeholder Evidence:** User studies, surveys, interviews, workshops

**See also:** [Evidence Quality](#evidence-quality)

### Evidence Quality

The evaluation of evidence based on criteria such as relevance (does it support the claim?), reliability (is it trustworthy?), and sufficiency (is there enough?). High-quality evidence is essential for convincing assurance cases.

**Related Resource:** [Evidence Quality Rubric](../templates/evidence-quality-rubric.md)

---
## F

### Fairness Case

An assurance case specifically focused on demonstrating that a system operates fairly and does not discriminate against individuals or groups. Addresses issues such as bias, equitable impact, and procedural fairness.

**See also:** [Assurance Case](#assurance-case), [Safety Case](#safety-case)

---
## G

### Gap Analysis

The systematic process of identifying weaknesses, missing evidence, under-supported claims, incomplete strategies, or missing context in an assurance case. Gap analysis helps improve argument completeness and quality.

**Related Module:** [Module 3: Letting the TEA Steep](../tea-trainee/03-steep-tea.md)

### Goal Claim

The top-level claim in an assurance case that serves to direct the focus towards a particular value or principle (e.g., safety, fairness, explainability). Also called a **top-level normative goal** or **top-level goal claim**.

**Example:** "The recruitment AI system treats all candidates fairly."

**See also:** [Property Claim](#property-claim), [Claim](#claim)

### GSN (Goal Structuring Notation)

A graphical notation standard for representing argument structure in assurance cases. GSN defines symbols for goals, strategies, context, and evidence, and is widely used in safety-critical industries.

**See also:** [Argument-Based Assurance](#argument-based-assurance)

---
## H

### Harmonized Standards

In the European Union context, standards that have been referenced in the Official Journal of the EU and confer a presumption of conformity with legal requirements when followed.

**See also:** [Standards](#standards)

---
## I

### Iterative Development

The process of continuously refining and improving an assurance case over time as systems evolve, new information becomes available, or feedback is received. Assurance cases are living documents that should be updated throughout the system lifecycle.

**See also:** [Assurance Case](#assurance-case)

---
## J

### Justification

The reasoning or rationale that explains why evidence supports a claim or why a strategy is appropriate for decomposing a goal. Justifications make the logic of arguments explicit.

**See also:** [Deliberation](#deliberation), [Argument](#argument)

---
## K

### Knowledge Diffusion

The process by which technical knowledge, best practices, and standards spread across industries and sectors. Standards play a key role in knowledge diffusion by codifying and disseminating expertise.

**See also:** [Standards](#standards)

---
## L

### Link

A connection between elements in an assurance case. The two types of links are support links (showing how child elements support parents) and context links (showing how context constrains elements).

**See also:** [Support Link](#support-link), [Context Link](#context-link)

---
## M

### Modular Argument

An assurance argument structured with multiple interconnected sub-arguments or modules, each potentially having its own goal claim. Modular arguments allow complex systems to be assured in manageable parts.

**See also:** [Assurance Case](#assurance-case)

---
## N

### Normative Goal

A goal that expresses what ought to be the case based on values, ethics, or principles (e.g., "the system should be fair"). Distinguished from purely technical or functional goals.

**See also:** [Goal Claim](#goal-claim)

---
## O

### Over-claiming

Making claims that are broader, stronger, or more definitive than the available evidence can support. A common pitfall in assurance case development that undermines trustworthiness.

**See also:** [Evidence Quality](#evidence-quality), [Gap Analysis](#gap-analysis)

---
## P

### Property Claim

A lower-level claim made about a specific property of a system or the project that developed it. Property claims collectively support and specify the top-level goal claim. An assurance case typically has many property claims linked to a single goal claim.

**Example:** "The training data is representative of the target population."

**See also:** [Goal Claim](#goal-claim), [Claim](#claim)

### Proposition

A statement that can be evaluated as true or false. Claims in assurance cases are formulated as propositions to enable determination of what is being claimed and whether evidence is sufficient.

**See also:** [Claim](#claim)

---
## Q

### Quality Assurance

The systematic process of ensuring that assurance cases meet defined quality criteria including completeness, coherence, validity of reasoning, and sufficiency of evidence.

**See also:** [Evidence Quality](#evidence-quality), [Gap Analysis](#gap-analysis)

---
## R

### Regulatory Compliance

Adherence to laws, regulations, and mandatory requirements set by governing bodies. Assurance cases can demonstrate regulatory compliance by showing how systems meet required standards.

**See also:** [Standards](#standards)

---
## S

### Safety Case

An assurance case specifically focused on demonstrating that a system is acceptably safe for its intended use. Widely used in safety-critical domains such as aviation, healthcare, and autonomous systems.

**See also:** [Assurance Case](#assurance-case), [Fairness Case](#fairness-case)

### Stakeholder

Any individual, group, or organization that has an interest in or is affected by a system. Stakeholders include developers, users, regulators, affected communities, and others.

**Related Module:** [Module 4: Stakeholder Engagement](../tea-specialist/04-stakeholder-engagement.md)

### Standards

Rules, norms, or guidelines established for application within certain contexts and settings. Standards provide a dependable foundation for developing collective expectations about products, processes, services, or systems.

**Types include:**

* **Foundational and Terminological:** Define terms and concepts
* **Process, Management, and Governance:** Guide organizational practices
* **Measurement and Test Methods:** Specify testing approaches
* **Product and Performance Requirements:** Set quality criteria
* **Interface and Architecture:** Define interoperability specifications

**Related Module:** [Standards and their Role in Assurance](../standalone/standards.md)

### Standards Development Organization (SDO)

A recognized body that develops technical standards through stakeholder-driven processes guided by principles such as relevance, transparency, and consensus. Examples include ISO, IEC, IEEE, and BSI.

**See also:** [Standards](#standards)

### Strategy

An element in an assurance case that describes the reasoning or approach taken to decompose a goal or claim into sub-claims. Strategies provide scaffolding for arguments and make the logical structure explicit.

**Example:** "Argument by considering data quality and decision-making process."

**See also:** [Argument](#argument), [Assurance Case](#assurance-case)

### Support Link

A uni-directional relationship between two elements in an assurance case where the child element supports the parent element. Support links connect goals to strategies, strategies to claims, claims to evidence, etc.

**See also:** [Link](#link), [Context Link](#context-link)

---
## T

### TEA Platform

The interactive online tool that allows project teams to create, edit, collaborate on, and share assurance cases using a graphical interface. Part of the broader TEA ecosystem.

**See also:** [Trustworthy and Ethical Assurance (TEA)](#trustworthy-and-ethical-assurance-tea)

### Testing

The process of evaluating a system against defined criteria to gather evidence of performance, functionality, or compliance with requirements. Test results serve as evidence in assurance cases.

**See also:** [Evidence](#evidence), [Benchmarking](#benchmarking)

### Top-Level Goal Claim

See [Goal Claim](#goal-claim)

### Trustworthy and Ethical Assurance (TEA)

A methodology and platform for using structured argumentation to clearly demonstrate how claims about a system's goals are warranted given the available evidence. TEA emphasizes transparency, critical reasoning, and stakeholder engagement.

**Definition:** "A process of using structured argumentation to clearly demonstrate how a set of claims about some goal of a system are warranted, given the available evidence."

**See also:** [Argument-Based Assurance](#argument-based-assurance), [TEA Platform](#tea-platform)

---
## U

### Uncertainty

The degree to which evidence, predictions, or claims are imprecise or subject to variability. Acknowledging and communicating uncertainty is important for honest and trustworthy assurance.

**See also:** [Evidence Quality](#evidence-quality)

---
## V

### Validation

The process of ensuring that an assurance case accurately represents the system and that claims are true. Validation involves checking that the right things are being assured.

**See also:** [Quality Assurance](#quality-assurance)

### Verification

The process of checking that an assurance case is internally consistent, complete, and follows proper structure. Verification ensures the assurance case is correctly constructed.

**See also:** [Quality Assurance](#quality-assurance)

---
## W

### Warrant

The reasoning that connects evidence to a claim, explaining why the evidence supports the claim. In some argumentation frameworks (e.g., Toulmin's model), warrants are distinguished from evidence itself.

**See also:** [Justification](#justification), [Evidence](#evidence)

---
## X

*(No entries)*

---
## Y

*(No entries)*

---
## Z

*(No entries)*

---
## Acronyms and Abbreviations

| Acronym   | Full Term                                           | Definition                                                                           |
| --------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **AI**    | Artificial Intelligence                             | Computer systems designed to perform tasks that typically require human intelligence |
| **AMLAS** | Assurance of Machine Learning in Autonomous Systems | Guidance framework for ML safety assurance                                           |
| **BSI**   | British Standards Institution                       | UK national standards body                                                           |
| **CAE**   | Claims-Arguments-Evidence                           | Framework for structuring assurance arguments                                        |
| **DCB**   | Data Coordination Board                             | NHS standards governance board                                                       |
| **EU**    | European Union                                      | Political and economic union of European member states                               |
| **GSN**   | Goal Structuring Notation                           | Graphical notation for assurance cases                                               |
| **IEC**   | International Electrotechnical Commission           | International standards organization for electrotechnology                           |
| **IEEE**  | Institute of Electrical and Electronics Engineers   | Professional association and standards organization                                  |
| **ISO**   | International Organization for Standardization      | International standards development organization                                     |
| **ML**    | Machine Learning                                    | Subset of AI focused on learning from data                                           |
| **NHS**   | National Health Service                             | UK public healthcare system                                                          |
| **SDO**   | Standards Development Organization                  | Body that develops formal standards                                                  |
| **TEA**   | Trustworthy and Ethical Assurance                   | The methodology and platform described in this curriculum                            |
| **W3C**   | World Wide Web Consortium                           | International standards organization for the web                                     |

---
## Contributing to the Glossary

This glossary is a living document. If you encounter a term that should be added or find a definition that needs clarification:

1. **Check if the term already exists** using the search function
2. **Propose additions or changes** via [GitHub Issues](https://github.com/alan-turing-institute/AssurancePlatform/issues)
3. **Follow the format:**
   * **Term (heading level 3)**
   * Definition (1-3 sentences)
   * Related terms with links (See also:)
   * Related modules/resources if applicable

---
## References

Key sources for terminology in this glossary:

* Goal Structuring Notation Community Standard (Version 3)
* ISO/IEC 15026: Systems and Software Assurance
* ISO/IEC 22989: Artificial Intelligence Concepts and Terminology
* Kelly, T. (1998). Arguing Safety: A Systematic Approach to Managing Safety Cases. University of York.
* TEA Platform Documentation and Curriculum Modules

---
**Version:** 1.0 | **Last Updated:** November 2025

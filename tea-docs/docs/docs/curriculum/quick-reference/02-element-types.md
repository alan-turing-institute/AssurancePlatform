---
title: "Element Types Guide"
description: "Quick reference for assurance case element types and their relationships"
sidebar_label: "Element Types"
sidebar_position: 3
tags:

  - quick-reference
  - elements

---
# Element Types Guide

A quick reference for the five core element types in TEA assurance cases.

## Element Types Overview

| Element            | Symbol | Purpose                   | Example                                              |
| ------------------ | ------ | ------------------------- | ---------------------------------------------------- |
| **Goal Claim**     | G      | Top-level normative claim | "The AI system is fair to all users"                 |
| **Property Claim** | PC     | Specific system property  | "The model has been tested for demographic parity"   |
| **Strategy**       | S      | Decomposition approach    | "Argument by addressing data, model, and deployment" |
| **Evidence**       | E      | Supporting information    | "Fairness audit report dated 2024-10-15"             |
| **Context**        | C      | Boundaries and scope      | "System is used in regulated healthcare setting"     |

## Goal Claims

**Purpose**: Top-level claim directing the entire assurance case

**Characteristics**:

* Normative (states what should be true)
* Usually just one per case
* Sets direction for all other elements

**When to use**:

* Starting a new assurance case
* Defining what you're trying to assure

**Example formulations**:

* "The system is safe for use in \[context]"
* "The AI model is fair to \[stakeholder group]"
* "The deployment process is secure"

:::tip[Keep Goals Clear]

Goals should be clear enough that someone outside your team can understand what you're claiming.

:::

## Property Claims

**Purpose**: Specific, testable claims about system properties

**Characteristics**:

* More specific than goals
* Multiple claims support each goal
* Can be nested (sub-claims)
* Should be testable or verifiable

**When to use**:

* Breaking down a goal into specifics
* Making testable assertions
* Creating sub-arguments

**Good property claims**:

* ✅ "The model achieves >95% accuracy on test data"
* ✅ "Training data includes representative samples from all demographic groups"
* ✅ "Privacy-preserving techniques are applied to all user data"

**Poor property claims**:

* ❌ "The system works well" (too vague)
* ❌ "We followed best practices" (not specific)
* ❌ "The model is good" (not testable)

## Strategies

**Purpose**: Explain the reasoning behind decomposition

**Characteristics**:

* Scaffolding for argument structure
* Connect goals to claims
* Make reasoning explicit

**When to use**:

* When breaking down a goal into multiple claims
* To explain your decomposition approach
* To organize complex arguments

**Common strategy patterns**:

* **By attribute**: "Argument over key system attributes: accuracy, fairness, reliability"
* **By lifecycle**: "Argument over stages: data, training, deployment, monitoring"
* **By stakeholder**: "Argument by addressing needs of: developers, users, regulators"
* **By component**: "Argument over system components: frontend, backend, database"

:::info[Strategies Are Optional]

While strategies improve clarity, they're optional for simple cases. Use them when they add value.

:::

## Evidence

**Purpose**: Ground claims in verifiable information

**Characteristics**:

* Concrete and specific
* Linked to one or more property claims
* Should be accessible/verifiable
* Can be of various types

**Evidence types**:

* **Technical**: Test results, metrics, benchmarks, error rates
* **Process**: Audits, certifications, procedures, documentation
* **Stakeholder**: Surveys, interviews, feedback, workshop outputs
* **Standards**: Compliance with recognized standards

**Good evidence descriptions**:

* ✅ "Fairness audit conducted by \[organization], dated \[date], showing demographic parity within 2%"
* ✅ "User survey (n=200, representative sample) showing 87% satisfaction"
* ✅ "Penetration test report identifying and addressing 15 vulnerabilities"

**Poor evidence descriptions**:

* ❌ "Test results" (too vague)
* ❌ "We did testing" (no details)
* ❌ "Good feedback" (not specific)

## Context

**Purpose**: Define scope, boundaries, and constraints

**Characteristics**:

* Sets boundaries for claims
* Makes assumptions explicit
* Clarifies what's included/excluded

**When to use**:

* Defining system boundaries
* Specifying use cases
* Stating assumptions
* Clarifying limitations

**Common context types**:

* **System context**: What system, its purpose, where deployed
* **Use context**: Specific scenarios, user groups, environments
* **Technical context**: Platforms, frameworks, architectures
* **Regulatory context**: Applicable standards, regulations, policies
* **Scope context**: What's included/excluded from the case

**Example contexts**:

* "This assurance case applies to Version 2.1 deployed in UK healthcare"
* "System is used by trained professionals, not general public"
* "Scope excludes third-party integrations and legacy data"

## Valid Relationships

### Support Links (Parent → Child)

Valid connections showing logical support:

```
Goal Claim → Strategy
Goal Claim → Property Claim
Strategy → Property Claim
Property Claim → Property Claim (sub-claims)
Property Claim → Strategy
Property Claim → Evidence
```

### Context Links

Valid context attachments:

```
Goal Claim → Context
Property Claim → Context
Strategy → Context
```

:::warning[Invalid Links]

The platform prevents invalid links. If you can't create a link, it's not a valid relationship in the TEA structure.

:::

## Element ID Conventions

Standard naming for clarity:

* **Goals**: G1, G2, G3...
* **Property Claims**: PC1, PC2, PC3... or PC1.1, PC1.2 for sub-claims
* **Strategies**: S1, S2, S3...
* **Evidence**: E1, E2, E3...
* **Context**: C1, C2, C3...

## Quick Decision Guide

**"What element should I add?"**

1. **Starting new case?** → Add Goal Claim first
2. **Breaking down goal?** → Add Strategy (optional) then Property Claims
3. **Supporting a claim?** → Add Evidence or sub-claims
4. **Need to explain decomposition?** → Add Strategy
5. **Clarifying scope?** → Add Context

## Further Reading

* **Detailed tutorial**: [Pouring Your First Cup of TEA](../tea-trainee/01-first-sip.md)
* **Element definitions**: [Glossary](../shared/glossary.md)
* **Worked examples**: [Case templates](../shared/templates/)
* **Evidence quality**: [Evidence Quality Rubric](../shared/templates/evidence-quality-rubric.md)

:::tip[Learning by Doing]

The best way to understand elements is to build a case. Try importing the [template case](../shared/templates/case-structure-template.json) and exploring it.

:::

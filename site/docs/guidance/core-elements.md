---
status: draft
tags:
  - assurance
  - core elements
---

# Core Elements of an Assurance Case

!!! info "Summary"

    In this section we will look at the core elements of an assurance case and how they relate to one another.

There are many ways to construct an assurance case and several standards exist to help users adopt shared practices.
For instance, the Goal Structuring Notation has thorough and comprehensive documentation for building assurance cases that align with their standards.

Trustworthy and Ethical Assurance diverges from other approaches, primarily because it aims to simplify the process of developing, communicating, and evaluating an argument and the evidence that justifies it, in order to make the process more open and inclusive to a broader community of stakeholders and users.
That is, we prioritise *accessibility* and *simplicity*.

!!! warning "A Note on Terminology"

    An assurance case presents an *argument*. Here, the argument is the logical sequence of claims that serve as premises for the over-arching conclusion. The validity of the assurance case depends both on the structure and content of the claims (i.e. the argument), but also on the evidence that is offered to ground the argument.

The trade-off is that assurance cases developed using our platform are *less expressive* than others, but (hopefully) easier to understand.

All assurance cases contain the following core elements:

``` mermaid
graph TD
  A[Goal Claim] --> B("`Property Claim(s)`");
  B --> C[(Evidence)];
```

Let's look at each of these elements in turn.

## Goal Claim

A *goal claim* serves to direct the process of developing an assurance case towards some value or principle that is desirable or significant.
For instance, it may be important to communicate how a product is 'Sustainable', how an algorithmic decision-making system is 'Explainable', or how the deployment of some service is 'Fair'.
The type of goal chosen will determine the set of claims and evidence that are *relevant* and *necessary* for the overall assurance case.
As such, a goal claim should be the first element to be established.
Although, like all elements, it can be iteratively revised and refined as the assurance process develops.

### Example

``` mermaid
graph TD
  A["`The outputs of our system are *explainable*.`"] -.-> B(...);
```

!!! info "Multiple Goals and Modular Arguments"

    In this section, we only discuss arguments with a single goal. However, nested (or, modular) assurance cases can also be developed where multiple goal claims serve as sub-claims into a broader argument that subsumes the lower-level arguments.

## Property Claim(s)

Goal claims need to be succinct and easy to understand.
However, this comes at the cost of *specificity*.
For instance, what does it mean to deploy a service in a fair manner, or to develop a sustainable product?
Property claims help to answer such questions within the context of the project being undertaken.

The majority of assurance cases, if not all, have multiple property claims.
Collectively, they serve to establish the central argument for how the goal claim has been established.
That is, they are the premises that support the conclusion.

``` mermaid
graph TD
  A["`The outputs of our system are *explainable*.`"] --> B("`The ML model used is *interpretable*`".);
```

## Evidence

Evidence is what grounds an assurance case.
Whereas goal claims orient a case and property claims help specify and establish an argument, evidence is what provides the basis for trusting the validity of the case as a whole.

The types of evidence that need to be communicated will depend on the claims being put forward.
For instance, if a claim is made about user's attitudes towards some technology or system, then findings from a user workshop may be needed.
Alternatively, if the claim is about a model's performance exceeding some threshold, then evidence about the test will be needed (e.g. benchmarking scores and methodology).

``` mermaid
graph TD
  B("`Users find the explanations offered by the system to be accessible and informative.`") --> C[("`Results from user testing workshop.`")];
  D("`Our model has sufficient accuracy for deployment.`") --> E[("`Methodology and results from testing and validation.`")];
```

!!! info "Evidential Standards"

    Similar to a legal case, where evidence needs to be admissible, relevant, and reliable, there are also standards for which types of evidence are appropriate in a given context.
    
    In some cases, technical standards may exist that can help bolster the trustworthiness of an argument, by allowing a project team to show how their actions adhere to standards set by an external community.
    
    In other cases, consensus may only emerge through the communication and evaluation of the evidence itself.

## Additional Elements

On top of the core elements described above, there are several additional elements that help improve the clarity and accessibility of an argument.
They are:

- Context statements
- Evidential Claims

### Context Statements

There are various types of context statements that can be added to the core elements of an assurance case.
For instance, consider the following example:

``` mermaid
graph RL
  A(["`The system will be used within a hospital by healthcare professionals for triaging patients.`"]) --> B["`The outputs of our system are *explainable*.`"];
```

### Evidential Claims

If the rationale for selecting some evidence to support a specific property claim (or set of claims) is not clear, an intermediate 'evidential claim' may be required.

For instance, the relevance of a partial dependency plot as supporting evidence for how a machine learning model is interpretable may be clear to some stakeholders, but a) this depends on prior expertise and b) may not address further questions, such as why individual feature importance is sufficient for establishing interpretability.

An evidential claim would help provide further clarity, by making explicit any assumptions made by the project team (e.g. interpretations of the system's behaviour will only be undertaken by trained experts).

``` mermaid
graph TD
  A("`The ML model used is *interpretable*`".) --> B;
  B(["`Expert interpreters can access information about feature importance.`"]) --> C[("`Partial dependency plot`")];
  A --> D(["`...`"]);
  D --> E[("`...`")];
```
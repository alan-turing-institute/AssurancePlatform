---
status: draft
tags:
  - Introductory Resource
---

# Understanding the Assurance Ecosystem

In 2021, the UK Government's
[Centre for Data Ethics and Innovation](https://www.gov.uk/government/organisations/centre-for-data-ethics-and-innovation)
released their
[AI Assurance Roadmap](https://www.gov.uk/government/publications/the-roadmap-to-an-effective-ai-assurance-ecosystem).
This publication set an agenda and series of recommendations for how to build
and govern an effective AI Assurance ecosystem.

In the context of AI, we can think of an assurance ecosystem as the framework or
environment that encompasses the methods, tools, roles, responsibilities,
stakeholders (and relationships between them) that collectively work towards
ensuring AI systems are designed, developed, deployed, and used in a trustworthy
and ethical manner. As such, it is an emerging concept, which is currently only
loosely defined but can, nevertheless, help us address the challenges posed by
AI technologies and maximise their opportunities.

!!! info "CDEI's AI Assurance Guide"

    The following is based on and adapted from the Centre for Data Ethics and Innovation's AI Assurance Guide, which extends their original roadmap and seeks to clarify the scope of an assurance ecosystem as it pertains to AI. We consider some of the core concepts of the CDEI's guide, focusing on the parts that are relevant to the TEA platform. For further information, please visit their site: [https://cdeiuk.github.io/ai-assurance-guide/](https://cdeiuk.github.io/ai-assurance-guide/)

## Why is Assurance Important

Data-driven technologies, such as artificial intelligence, have a complex
lifecycle. In some cases, this complexity is further heightened by the scale at
which a system is deployed (e.g. social media platforms with international
reach).

The scale and complexity of certain data-driven technologies has already been
clearly communicated by others, such as
[this excellent infographic](https://anatomyof.ai) from the AI Now Institute
showing the many societal impacts and touch points that occur in the development
of Amazon’s smart speaker. Therefore, it is not necessary to revisit this point
here. However, it is important to explain why this complexity and scale matters
for the purpose of trustworthy and ethical assurance. There are three
(well-rehearsed) reasons that are salient within the context of the assurance
ecosystem:

1. Complexity: as the complexity of a system increases it becomes harder to
   maintain transparency and explainability.
2. Scalability: the risk of harm increases proportional to the scale of a
   system, and mechanisms for holding people or organisations accountable become
   harder to implement.
3. Autonomous behaviour: where data-driven technologies are used to enable
   autonomous behaviour, opportunities for responsible human oversight are
   reduced.

## Justified Trust

As discussed at the start of this section, assurance is about building trust.

But there is a further concept, related to trust, which is vital for assurance:
trustworthiness.

As the CDEI's guide acknowledges:

> "when we talk about trustworthiness, we mean whether something is deserving of
> people’s trust. On the other hand, when we talk about trust, we mean whether
> something is actually trusted by someone, which might be the case even if it
> is not in fact trustworthy." A successful relationship built on justified
> trust requires **both** trust and trustworthiness: **Trust without
> trustworthiness = misplaced trust.** If we trust technology, or the
> organisations deploying a technology when they are not in fact trustworthy, we
> incur potential risks by misplacing our trust. **Trustworthy but not trusted =
> (unjustified) mistrust.** If we fail to trust a technology or organisation
> which is in fact trustworthy, we incur the opportunity costs of not using good
> technology.

![](../assets/images/justified-trust.png)

The concept of justified trust is, understandably, an integral part of
_trustworthy_ and ethical assurance.

We can turn to the moral philosopher, Onora O’Neill, for a clear articulation of
why this is so,

> “[...] if we want a society in which placing trust is feasible we need to look
> for ways in which we can actively check one another’s claims.

But, she continues,

> “[...] active checking of information is pretty hard for many of us.
> Unqualified trust is then understandably rather scarce.”

The CDEI's Assurance guide identifies two problems that help explain why active
checking is challenging:

- **An information problem:** organisations face difficulties in continuously
  evaluating AI systems and acquiring the evidence base that helps establish
  whether a system is trustworthy (i.e. whether users or stakeholders should
  place trust in the system)
- **A communication problem:** once they have established the trustworthiness of
  the system, there are additional challenges to communicate this to relevant
  stakeholders and users such that they trust the claims being made.

An effective assurance ecosystem should help actors overcome these issues to
establish _justified trust_. Let's take a look at some of the key actors in an
assurance ecosystem.

## Key Actors, Roles, and Responsibilites

AI is often described as sociotechnical. Here, the term "sociotechnical" is used
to emphasise how the design, development, deployment, and use of AI is deeply
intertwined with social systems and practices, and influenced by a wide array of
human and organisational factors. Because of this, any list of actors, and their
various roles and responsibilities will fall short in a number of dimensions.
However, the following graphic provides us with a good starting point for
understanding the key actors in an assurance ecosystem.

![This diagram depicts the AI assurance ecosystem, illustrating interactions between AI supply chain participants, AI Assurance Service Providers, Independent Researchers, and Supporting Structures like regulators and standards bodies.](../assets/images/actors.png)
_Figure 2. Key actors in the AI Assurance Ecosystem. Reprinted from CDEI (2023)
AI Assurance Guide.
https://cdeiuk.github.io/ai-assurance-guide/needs-and-responsibilities_

As the diagram depicts, certain actors have a direct influence into the supply
chain for AI systems. These are known as 'assurance users'. For instance,
organisations may have dedicated teams internally who are responsible for
quality assurance of products or services (e.g. compliance with safety
standards, adherence to data privacy and protection legislation). However, there
is a growing marketplace of independent 'assurance service providers' who offer
consultancy or services to other companies or organisations.[^market]

These users and providers are further supported by structures including
governments, regulators, standards bodies, and accreditation/professional
bodies. That is, the relationship between users and provides does not operate in
a vacuum, but within a complex environment of legislation, regulation, and
general norms and best practices.

[^market]:
    For example, [Credo AI](https://www.credo.ai/) offer a paid-for service that
    comprises an interactive dashboard and set of tools to help companies comply
    with existing and emerging policies and regulation. Whereas, other
    organisations, such as the
    [Ada Lovelace Institute](https://www.adalovelaceinstitute.org/project/algorithmic-impact-assessment-healthcare/)
    have developed open-source tools for teams to implement within their own
    projects.

This is a helpful starting point for gaining some purchase on the complex set of
interacting roles and responsibilities that collectively make up what is
admittedly a hard to delineate assurance ecosystem. Because the TEA platform
emphasises the importance of ethical reflection and deliberation, the resources
and materials are likely to be of specific interest to the following actors:

- Researchers
- Journalists/Activists
- Internal Assurance Teams
- Developers
- Frontline User
- Affected Individuals

## Assuring different subject matter

> Whether someone needs to build confidence in the trustworthiness of different
> products, systems, processes, organisations or people will influence the type
> of information required, and the techniques required to provide assurance.
> This is because different products, systems, processes, organisations and
> people have different aspects that affect their trustworthiness i.e. they have
> different assurance subject matters.

Whether a frontline user of a system is confident in using the system will
depend on a wide variety of factors. If the system is a medical device, and the
frontline user is a healthcare professional, safety and accuracy may be primary
concerns. However, if the system is an algorithmic decision-support tool, the
frontline user may care more about the explainabilty of the system.

Assurance needs, therefore, vary depending on what's being assured—products,
systems, processes, organisations, or individuals. Simple products like kettles
may have straightforward, measurable assurance criteria, whereas complex systems
like AI necessitate nuanced, multi-dimensional assurance approaches due to their
varied subject matters like robustness, accuracy, bias, explainability, and
others. As previously noted, the complexity of AI arises because of the
sociotechnical interactions between technical, organisational, and human
factors. Ethical principles such as fairness, privacy, and accountability are
intertwined with these interactions, necessitating comprehensive assurance
mechanisms.

While not specifically designed to address ethical principles, the following
diagram from the CDEI's Assurance Guide can help elucidate some of the reasons
why trustworthy and ethical assurance can be challenging.

<!--  rewrite following summary

1. **Unobservable versus Observable**:
   - Unobservable aspects refer to elements that cannot be directly seen or measured but might have implications, like potential societal harms from AI systems.
   - Observable aspects are those that can be directly seen, measured, or experienced, like testing the accuracy of an AI system against a clear standard.

2. **Subjective versus Objective**:
   - Subjective aspects involve personal judgments or opinions, like deciding which definition of fairness to apply in assessing an AI system.
   - Objective aspects refer to measurable, factual bases that do not rely on personal feelings or interpretations, like measuring false positive or false negative rates.

3. **Ambiguous versus Explicit**:
   - Ambiguous aspects lack clarity or are open to multiple interpretations, requiring more judgement for assurance. For instance, qualitative assessments of societal impacts or algorithmic bias.
   - Explicit aspects are clear, defined, and often quantifiable, like the accuracy of an algorithm against a specific metric.

4. **Uncertain versus Certain**:
   - Uncertain aspects are characterized by doubt and unpredictability, like the potential broader societal impacts from AI deployment.
   - Certain aspects are clear and definite, allowing for more definitive assurance.

Now, regarding the assurance of ethical principles for AI:

1. **Unobservable versus Observable**:
   - Ethical principles often concern values and norms, which might be unobservable directly. However, their operationalization could be observable through specific metrics or indicators, albeit imperfectly.

2. **Subjective versus Objective**:
   - Ethical principles are fundamentally subjective as they're rooted in societal values, cultural norms, and individual beliefs. However, once a consensus is reached on certain ethical standards, their application can be approached in a more objective manner through established metrics.

3. **Ambiguous versus Explicit**:
   - Ethical principles can be ambiguous due to differing interpretations and context-dependent nuances. Over time, through discourse and standardization, they may become more explicit, although some level of ambiguity is likely to remain.

4. **Uncertain versus Certain**:
   - The impact and effectiveness of applying ethical principles are often uncertain due to the complex, dynamic nature of AI and its interaction with society. However, certain ethical benchmarks or standards can provide a level of certainty in evaluation.

The application of ethical principles in AI governance involves navigating these dimensions to ensure that the AI systems are developed and deployed responsibly. The challenge lies in translating abstract ethical principles into concrete practices and metrics for evaluation while acknowledging and addressing the inherent subjectivity, ambiguity, and uncertainty involved in ethical considerations.

-->

![](../assets/images/subject-matter.png) _Figure 3. A graphic showing the four
dimensions of assurance subject matter: unobservable/observable,
subjective/objective, ambiguous/explicit, uncertain/certain._

- In the context of the TEA platform, the different subject matter represent the
  domain of the assurance case, summarised in the top-level goal claim (e.g.
  fairness).

To what extent does the TEA methodology and platform align with the CDEI's 5
elements of assurance: https://cdeiuk.github.io/ai-assurance-guide/five-elements
-->

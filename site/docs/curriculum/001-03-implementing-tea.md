# Implementing TEA in a Project

%% - Reflect, Act, Justify—Operationalising Principles in TEA
S
- The SAFE-D Principles—Guiding Responsible Practices for Data-Driven Technologies
- The Project Lifecycle
 %%

## Reflect, Act, Justify—Operationalising Principles in TEA

TEA is not merely a tool for compliance.
Using TEA at the very end of a project, just prior to deploying a service or bringing a product to market, would be a mistake.
Why?
Because it would fail to leverage the utility of the TEA platform to support a broader process of reflection, deliberation, and communication.

The TEA platform instantiates a type of argument-based assurance that focuses on normative or ethical goals and principles (e.g. fairness, explainability), which help establish justified trust in data-driven technologies, such as artificial intelligence or digital twins.

%% Ethical principles are not to be confused with *rules.* Ethical principles, like those offered here, should be thought of as goals and framing devices; Ethical principles support individual and team reflection and deliberation, while rules are fixed and place harder limits on choice and action. SAFE-D is a set of principles rather than rules.

There are many contextual factors of projects that alter the way in which the principles are applied, and the weighting of the principles themselves. For instance, a particular project may prioritise ensuring the fair treatment of individuals over the explainability of the system in question based on an initial assessment of the project's risks and opportunities.

As such, the SAFE-D Principles have been designed to guide the assessment of ethical risks and opportunities. They serve a similar role to safety or security concepts in quality assurance and risk assessment and analysis processes. Therefore, they should be complementary to existing practices (e.g. Analytical Quality Assurance). %%

## Stakeholder Engagement

## Optional Resources

### The SAFE-D Principles—Guiding Responsible Practices for Data-Driven Technologies

Trustworthy and Ethical Assurance could apply to many systems, but the TEA
platform specifically addresses data-driven technologies, such as artificial
intelligence or digital twins.

There are many benefits and risks associated with the design, development, and
deployment of data-driven technologies.
A variety of frameworks have been developed to help organise and categories these benefits and risks, many of which include principles for guiding the management of the benefits and risks. ^[principles]

Although the TEA platform is agnostic to the set of principles used by a project team, a set of ethical principles is established by the project team to aid the responsible design, development, and deployment of data-driven technologies.
We refer to these as the SAFE-D principles.

The SAFE-D Principles are a set of ethical principles that serve as starting points for reflection and deliberation about possible harms and benefits associated with data-driven technologies. The acronym, **'SAFE-D'** stands for the following ethical principles:

- #### Sustainability
  - Sustainability can mean many things. From a technical perspective, sustainability requires the outputs of a project to be safe, secure, robust, and reliable. For example, for a system that supports decision making in courts, prisons, or probation, sustainability as _reliability_ may depend on the availability, relevance, and quality of data. 
  -  In criminal justice, _safety_ has particular salience where the effects of AI systems have implications for users of the justice system and members of society in general. In the context of responsible data science and AI, societal sustainability also requires a project's practices to be informed by ongoing consideration of the risk of exposing individuals to harms even well after the system has been deployed and the project completed---a long-term (or sustainable) safety.

- #### Accountability
  -  Accountability requires:
      - *Transparency* of processes and associated outcomes coupled with processes of clear communication that enable relevant stakeholders to understand how a project was conducted or why a specific decision was reached (e.g. project documentation) and, 
      - The establishment of clear roles and duties to ensure that the project is governed and conducted in a *responsible* manner. Establishing a single point of contact or ownership for a project is a means of ensuring accountability. In coding environments, formal version control practices are central to establishing accountability for aspects of a system. In the criminal justice context, you and your project team may be familiar with the Analytical Quality Assurance standards for quality assurance in context of data.

- #### Fairness
  -  Determining whether the design, development, and deployment of data-driven technologies is fair begins with recognising the full range of rights and interests likely to be affected by a particular system or practice. 
  -  From a legal or technical perspective, projects outcomes should not create impermissible forms of discrimination (e.g. profiling of people based on protected characteristics) or give rise to other forms of adverse impact (e.g. negative effects on social equality). Statistical metrics of fairness may be relevant here. 
  - Second, there are implications that fall within broader conceptions of justice, such as whether the deployment of a technology (or use of data) is viewed by impacted communities as disproportionately harmful (e.g. contributing to or exacerbating harmful stereotypes)
  - Fairness in the context of criminal justice requires a careful balancing between respecting the rights and interests of all parties, including victims, defendants, prisoners, family members, and staffmembers, while also ensuring societal safety and protecting the most vulnerable from harm. While statistical approaches to fairness may be useful to achieving this, social awareness and stakeholder consultation are also important considerations. 

- #### Explainability
  - Explainability refers to a property of a data-driven technology (e.g. AI system) to support or augment an individual's ability to explain the behaviour of the respective system. It is related to but separate from *interpretability*. 
  - For instance, whereas a ML algorithm may be more or less interpretable based on underlying aspects of its architecture (e.g. simple to understand decision trees versus a complex convolutional neural network), the ability to explain how an algorithm works depends in part on properties of the wider system in which an algorithm is deployed. 
  - The expertise of system producers and users is also a factor; sometimes the even the people who choose or develop a model are challenged to understand it completely. Auxillary tools, such as dashboards or feature selection tools, may be required. 
  - The principle of explainability can often conflict or be in tension with other principles, such as confidentiality or safety, requiring careful balancing of interests.

- #### Data Stewardship
  - The principle of Data Stewardship is intended to focus an ethical gaze onto the data that undergirds AI/ML projects.  
    - **'Data Quality'** captures the static properties of data, such as whether the contents of a data set are a) relevant to and representative of the domain and use context, b) balanced and complete in terms of how well the dataset represents the underlying data generating process, and c) up-to-date and accurate as required by the project.
    - **'Data Integrity'** refers to more dynamic properties of data stewardship, such as how a dataset evolves over the course of a project lifecycle. In this manner, data integrity requires a) contemporaneous and attributable records from the start of a project (e.g. process logs; research statements), b) ensuring consistent and verifiable means of data analysis or processing during development, and c) taking steps to establish findable, accessible, interoperable, and reusable records towards the end of a project's lifecycle.
    - **'Other Considerations**' include legal obligations, including adherence to data protection and human rights law as well as adherence to court, custody, and probation rules and procedures. Additional legal and policy obligations may apply to any data considered 'law-enforcement' data. 

## How do you operationalise them?

While the SAFE-D Principles establish a common framework and shared understanding of the ethical risks and opportunities associated with data-driven technologies, they are not sufficient on their own to guide practical decision-making. In other words, they do not prescribe a set of decision rules or actions that should be undertaken to ensure the principle has been fully established within a project's activities. Instead, they serve as starting points in a process of specification, operationalisation, and eventually, assurance.

To play the role required of them, therefore, the SAFE-D Principles first need to be operationalised. That is, they need to be tailored (or, made operational) to the *context* of the specific project.

The process for achieving this can be summarised as follows:

1.  **Identification**: Identify which principles are **relevant** to the project based on a preliminary and proportional assessment of the project's risks and opportunities.
2.  **Weighting**: Determine which of the principles are **most important** based on their alignment with the goals and objectives of the project. Here, goals and objectives should be informed by inclusive stakeholder engagement.
3.  **Specification**: Using the list of associated core attributes, specify the principles in a way that is precise enough to enable the project team to make decisions about the project's activities.
4.  *Revision*: Repeat the process as necessary (e.g. through iterative stakeholder engagement).
5.  **Implementation**: Implement the actions determined through operationalising the principles into the project's activities, and monitor and evaluate their effectiveness.

<!-- disable mermaid graphic if outputting to docx -->

```{mermaid}
%%| label: fig-operationalisation
%%| fig-cap: Process for operationalising the SAFE-D Principles
flowchart LR
  1(Identification) ---> 2(Weighting)
  2 ---> 3(Specification)
  3 --Revision--> 1
  3 --> 4(Implementation)
```

<!-- enable following image when outputting to docx -->

<!-- ![](../assets/images/operationalisation.png){#fig-operationalisation fig-alt="Process for operationalising the SAFE-D principles" width="500px"} -->

Let's look at each of these stages in more detail.

### Identifying ethical risks and opportunities

The simplest starting point for identifying whether a project is vulnerable to some ethical risk is to ask and reflect upon a series of questions, such as the following:

-   Is there a risk of creating an *unsustainable* system?
-   Are there issues with how the team's roles and responsibilities have been distributed, and could this lead to an *accountability* gap?
-   Are specific groups of people likely to be *disproportionately* affected by the project? Is this *unfair* or could it be perceived as *unjust*?
-   Is there a risk of creating a system that is not *explainable*?
-   Are we able to collect, store, analyse, and use high-quality *data* in a responsible way?

It should be clear that each of these questions is a deliberative prompt for one of the SAFE-D Principles. And, as such, it is presupposed that some understanding of the principles is required to answer them (see [the explanations](#what-are-the-safe-d-principles) above). Whether there is sufficient understanding of the principles within the team though will depend on a range of factors, including skills and training in areas like data ethics and AI ethics, diversity of experience and expertise, and the extent to which the principles have been embedded into the project's culture.

However, even if a team and organisation have access to a dedicated data ethicist, for example, the ability to answer these questions sufficiently will require diverse and inclusive forms of stakeholder engagement.

::: callout-important
## Stakeholder Engagement

As with the other stages, wide-ranging and diverse stakeholder engagement is essential to the process of operationalising the SAFE-D Principles.

For instance, in the example of the prison algorithm (see [above](#specifying-ethical-principles-)), social researchers may need to be consulted to help the project team identify limitations of their proposed predictive algorithm, to ensure that contextual forms of vulnerability and risks of discriminatory harm are addressed in the design of the system (e.g. mental health disorders of prisoners or risk profiling based on protected characteristics). Similarly, the prison staff who will be using the system will need to be consulted to ensure that the system design actually promotes the achievement of the intended results, and also that is perceived by its users as both useful and usable.

A stakeholder engagement process, therefore, is an essential component of operationalising the SAFE-D Principles. Not only can it help uncover new risks that may not have been identified during the initial project scoping, but it creates room for diverse forms of expertise to shape and contribute to a project. A guide for running a stakeholder engagement process is provided in our [toolkit](intro-toolkit.qmd).
:::

### Weighing ethical principles

Weighing ethical principles is a process of determining which principles are most important based on their alignment with the goals and objectives of the project. Weighing principles is necessary for two reasons:

1.  It establishes a *proportional* approach to the assessment of ethical risks and opportunities
2.  It helps to resolve conflicts between principles

:::{.callout-tip collapse="true"}
## Illustrating the first reason

Consider the principle of sustainability. Without a (meta-)principle of proportionality governing a project, how should a team decide know how far into the future they must consider the possible impact of their system? At some point, the time spent evaluating potential risks and opportunities will become overly burdensome for the team and disproportionate to the actual (albeit unknown) risks of the system. Furthermore, if the team determine that a simple linear regression model is sufficient and will only ever be used as a minor decision support tool by the team's data analysts, then spending a lot of time deliberating about the principle of explainability will likely be unnecessary. 

In these senses, weighing ethical principles is necessary to ensure that a team use their time and resources in a proportionate and responsible way.
:::

:::{.callout-tip collapse="true"}
## Illustrating the second reason

Now, let's turn to the second reason. When framed as ideals, ethical principles can come into conflict with one another and also give rise to ethical dilemmas in their own right. 

For example, the principle of *explainability* may, at some level, come into conflict with the principle of *accountability* when determining how much information should be shared with the public about the system in question. 

Alternatively, the principle of *fairness* may appear to prescribe that a predictive algorithm should treat all groups equally with respect to some variable, but this may not be possible (nor desirable) in practice due to variations in the underlying base rate of the variable in question.
:::

While some of these conflicts may be resolved through the process of operationalisation, others may not be. In some cases the conflict may be the result of incommensurable values.

:::{.callout-note}
## The Children and the Flute

Consider the following dilemma, presented by Amartya Sen in his book *The Idea of Justice*, in which we operationalise some other ethical principles that may conflict with each other:

> \[...\] you have to decide which of three children---Anne, Bob and Carla---should get a flute about which they are quarrelling. Anne claims the flute on the ground that she is the only one of the three who knows how to play it (the others do not deny this), and that it would be quite unjust to deny the flute to the only one who can actually play it. If that is all you knew, the case for giving the flute to the first child would be strong. 
>
> In an alternative scenario, it is Bob who speaks up, and defends his case for having the flute by pointing out that he is the only one among the three who is so poor that he has no toys of his own. The flute would give him something to play with (the other two concede that they are richer and well supplied with engaging amenities). If you had heard only Bob and none of the others, the case for giving it to him would be strong.  
>
> In another alternative scenario, it is Carla who speaks up and points out that she has been working diligently for many months to make the flute with her own labour (the others confirm this), and just when she had finished her work, 'just then', she complains, 'these expropriators came along to try to grab the flute away from me'. If Carla's statement is all you had heard, you might be inclined to give the flute to her in recognition of her understandable claim to something she has made herself.

Each of the claims in the scenario of the flute appeal to a different ethical principle or set of values. Depending on the values that you hold and the principles you choose to prioritise, you may find yourself in agreement with either Anne, Bob, or Carla. However, you will not be able to satisfy all three of them simultaneously. 

In this case, the dilemma is the result of incommensurable notions of justice. While this specific dilemma arises because of the artificial nature of the example, it is important to recognise that incommensurable values are not uncommon in practice. Working with conflicts in applying  sincerely held values and the struggle to prioritise principles are a common feature of ethical deliberation. 

We say more about how to handle such trade-offs and dilemmas in our stakeholder engagement guide (see [toolkit](intro-toolkit.qmd)).
:::

We have considered two ways that principles can be weighed (or, weighted). In both cases, process is a form of *prioritisation* and as such it should be made transparent to all stakeholders. For, example on what grounds was it determined that *sustainability* was more important than *accountability*? With transparent explanations, further specification can *dissolve* what may appear at first glance to be dilemmas, but in reality are simply, by nature, a lack of precision in the principles themselves.

### Specifying ethical principles

Ethical principles are not formulas that can be followed step-by-step to reach a morally permissible outcome. Rather, they serve as starting points for careful reflection and deliberation among moral agents (e.g. people like you or others for whom the project has significant impacts).

A significant part of the process of operationalisation is making the principles *precise enough* that they reflect the nuances of the specific context in which they are utilised. This process is known as 'specification'. Consider the following example:

:::{.callout-note}
## Illustrative Example

A project team is considering whether a new predictive algorithm should be designed and trialled within prisons to monitor prisoner behaviour and assess the risk of physical harm (either to themselves or another prisoner). The project team know there is a risk of bias associated with such technologies, based on their preliminary assessment, and they now want to ensure that they develop a *fair* system. But what does the SAFE-D Principle 'fairness' mean and require of the project team in this context?

The project team come up with the following proposals:

1.  The system will be fair if it does not discriminate amongst prisoners based on their protected characteristics (e.g. race, age).
2.  The system will be fair if it improves the safety outcomes of the most vulnerable within the prison environment.
3.  The system will be fair if it does not create or exacerbate biased forms of decision-making among the prison staff who use it.

Each of these statements is a more specific form of the fairness principle. That is, it specifies how fairness is understood in the context of the project.

The above proposals are not mutually exclusive. One or more of the statements may be significant, depending on the possible harms that could arise because of the project.

The process of specifying the ethical principle is significant, but it still does not establish how the principle will be used throughout the project's lifecycle to guide practical decision-making.

This involves the preliminary identification of the core attributes that need to be established across the project lifecycle, and the initial consideration of the decisions and actions that will ensure the principle has been fully realised. @tbl-core-attributes lists several core attributes that may be identified during the operationalisation of a fairness principle. A wide variety of factors will determine which core attributes are important to consider during a project's lifecycle, as well as when they should be considered.

:::

:::{.callout-note collapse="true"}
## Expanding this example

Continuing with the prisoner safety example, one core attribute you and your team may want to prioritise may be to ensure that there is no discrimination of prisoners by the system when it comes to monitoring prisoner behaviour.

As part of the fairness principle under SAFE-D, a system or model should not create or contribute to circumstances whereby members of protected groups are treated differently or less favourably than other groups because of their respective protected characteristic. To operationalise this, the project team start by discussing which stages of the project lifecycle are the most relevant to ensuring non-discrimination. These include:

- Data Extraction and Procurement: The project team needs to critically consider how data is gathered, collected, and extracted to ensure that the datasets used reflect prisoner demographics.
- Model Testing and Validation: The project team has identified that the potential model needs to be tested against a wide variety of metrics, where the evaluation of the model's accuracy should ensure that there are no statistical biases towards or against particular prisoners.
- Model Documentation: The project team agree to document and publish their data sources, simplified summary statistics, explanations of the model used, and the evaluation metrics to clearly embed non-discrimination throughout the project lifecycle both for internal and external stakeholers.

:::

A meta-principle of proportionality should be adopted, such that the core attributes that are focused on reflect the primary risks of the project (e.g. ‘non-discrimination’ if there is widespread use of protected characteristic in the dataset). 

| Core Attribute | Description  |
| -------------- | ------------ |
| Bias Mitigation  | It is not possible to eliminate bias entirely. However, effective bias mitigation processes can minimise the unwanted and undesirable impact of systematic deviations, distortions, or disparate outcomes that arise to a project governance problem, interfering factor, or from insufficient reflection on historical social or structural discrimination.  |
| Diversity and Inclusiveness  | A significant component of fairness-aware design is ensuring the inclusion of diverse voices and opinions in the design and development process through the collaboration of a representative range of stakeholders. This includes considering whether values of civic participation, inclusion, and diversity have been adequately considered in articulating the purpose and setting the goals of the project. Consulting with internal organisational stakeholders is also necessary to strengthen the openness, inclusiveness, and diversity of the project, as well as its acceptance. External stakeholders, such as civil society, NGOs, and affected communities, may be sought directly. This ensures that a collaborative spirit is adopted within projects and services where relevant voices are in the room.  |
| Non-Discrimination  | A system or model should not create or contribute to circumstances whereby members of protected groups are treated differently or less favourably than other groups because of their respective protected characteristic.  |
| Equality  |  The outcome or impact of a system should either maintain or promote a state of affairs in which every individual has equal rights and liberties, including equal treatment under the rule of law, equal access to the remedies of the justice system, and equal access or opportunities to whatever good or service the AI system brings about. |

: A table listing core attributes of the principle of fairness {#tbl-core-attributes} 

### Implementing ethical principles

Once a principle has been fully specified, the next stage is to reflect upon how the principle will determine particular actions or decisions within the context of the respective project.

This stage is where the next primary element is brought in, 'Argument-Based Assurance'.

### The Project Lifecycle

[^principles]:
    Floridi, L., & Cowls, J. (2019). A Unified Framework of Five Principles for
    AI in Society. Harvard Data Science Review, 1(1).
    https://doi.org/10.1162/99608f92.8cd550d1

[^ttw]:
    The Turing Way Community. (2022). The Turing Way: A handbook for
    reproducible, ethical and collaborative research. Zenodo. doi:
    10.5281/zenodo.3233853.
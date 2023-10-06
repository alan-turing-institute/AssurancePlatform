# An Introduction to Argument-Based Assurance

The TEA platform is built around a methodology known as argument-based assurance (ABA).

The general approach of ABA is to provide a reasoned and justified argument regarding some top-level claim (i.e. the goal). Historically, ABA has been used in safety-critical domains, such as aviation or energy, and so the top-level claims typically refer to goals such as reliability, safety, or security of a system. The main argument sets out the claims made about the system (including aspects of the project governance or design), the evidence supporting those claims, and the rationale that links the evidence to the claims.

!!! note "From safety assurance to ethical assurance"

    The TEA platform instantiates a type of argument-based assurance that focuses on ethical goals and principles (e.g. fairness, explainability), which help establish justified trust in data-driven technologies, such as artificial intelligence or digital twins.

ABA follows a process critical reasoning to create a convincing "story" or "case" that articulates why a system can be trusted to operate within certain contexts. The final artefact is known as an assurance case, and is typically presented in a visually intuitive form that supports accessible communication and assists critical engagement (e.g. identifying gaps in the argument, evaluating the strength of supporting evidence for linked claims). As such, ABA helps teams and stakeholders consider both positive evidence as well as possible counterarguments, gaps, and uncertainties, offering mitigations for those when possible.

!!! info "History of argument-based assurance"

    Add a short history of ABA.

One of the key strengths of this approach is its ability to facilitate clear communication among stakeholders, including researchers, developers, regulators, and system users. By making assumptions explicit and providing a structured framework for critical reasoning, ABA facilitates a transparent, understandable and reproducible assurance process. It also offers a flexible and extensible way to integrate various types of evidence (and [standards](standards.md)), such as empirical data, expert opinion, and formal methods, into a cohesive argument.

However, ABA is not without its challenges[^habli]. Constructing a rigorous argument requires significant expertise, can be time-consuming, and the quality of the argument is heavily dependent on the strength and sufficiency of the underlying evidence. Furthermore, there are also concerns regarding how to update or modify assurance arguments as systems evolve or when new information becomes available.

To address some of these challenges, the TEA platform takes a community-driven approach to increasing capabilities and best practices within the [assurance ecosystem](assurance-ecosystem.md).

[^habli]: Habli, I., Alexander, R., & Hawkins, R. D. (2021). Safety Cases: An Impending Crisis? In Safety-Critical Systems Symposium (SSS’21). https://core.ac.uk/download/pdf/363148691.pdf 

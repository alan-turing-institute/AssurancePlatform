# Case Study: Advancing Cardiovascular Medicine with CemrgApp

<!-- Embed video and transcript here -->
<iframe class="youtube-video" src="https://www.youtube.com/embed/2V8FAu2U4MM" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

## Introduction to CemrgApp

The CemrgApp, developed by the Cardiac Electromechanics Research Group (CEMRG) at Imperial College London, is a transformative tool designed to enhance the analysis of cardiovascular data through advanced imaging and computational techniques. This case study focuses on how CemrgApp uses the Trustworthy and Ethical Assurance (TEA) Platform to enhance its Scar Quantification Tool (SQT), specifically through the integration of fairness assurance analyses.

!!! warning

    This case study is a work-in-progress and represents a snapshot of ongoing developments. The set of claims and analyses should not be considered a complete assurance case.

## Overview of the Scar Quantification Tool

The SQT employs Late Gadolinium Enhanced Cardiac Magnetic Resonance (LGE-CMR) to non-invasively identify scar tissue in the heart’s left atrium. This tool is essential for clinicians to detect potential cardiac issues and strategise effective treatments. The SQT follows a sophisticated process:

1. **Segmentation**: Delineates the left atrium from the rest of the heart.
2. **3D Modeling**: Generates a three-dimensional representation of the atrium.
3. **Scar Mapping**: Applies color-coded mapping to visualise scar tissue based on signal intensity.

These stages are managed through an intuitive interface designed to streamline the clinical workflow.

## Applying TEA Platform for Fairness Assurance

A crucial aspect of this case study is the fairness assurance analysis conducted for the SQT. We structured an assurance case focusing on mitigating bias, promoting diversity and inclusivity, and ensuring equitable impact and non-discrimination in model outcomes. The process included:

- **Identifying Fairness Attributes**: Establishing core attributes of fairness including bias mitigation, inclusivity, equitable impact, and non-discrimination that align with the TEA Platform’s methodology.
- **Developing Claims**: Each attribute of fairness was addressed through specific, actionable claims backed by empirical evidence and theoretical research.
- **Operationalisation**: Implementing these claims through software features and clinical practices, such as standardised analysis protocols to reduce operator variability and bias in diagnostic outcomes.

## Key Fairness Claims and Their Justification

- **Bias Mitigation**: The SQT standardises scar tissue analysis, which limits the variability that can arise from manual interpretations influenced by cognitive biases.
- **Inclusivity**: The tool’s interface is designed to facilitate comprehensive patient and clinician engagement, supporting informed decision-making through clear, interactive visualisations.
- **Equitable Impact**: Open-source access and minimal resource requirements make the SQT broadly available, ensuring diverse clinical settings can benefit from advanced diagnostic tools.
- **Non-Discrimination**: Advanced machine learning models are employed and regularly validated to minimise biases and maintain consistent performance across diverse patient groups.

## Challenges in Assurance

While the TEA Platform provided a robust framework for developing the fairness assurance case, challenges such as demographic validation, user engagement, and iterative validation of the tool's fairness have been acknowledged. These issues underscore the necessity for continuous improvement and adaptation in response to evolving clinical needs and technological advancements.

## Conclusion

The CemrgApp case study exemplifies the effective application of the TEA Platform’s fairness assurance methodology in a high-stakes clinical environment. By prioritising ethical standards and actionable fairness claims, the project not only improves cardiovascular healthcare outcomes but also advances the field towards more equitable and transparent medical technology practices.

!!! info "Ongoing Developments and Future Directions"

    CEMRG continues to refine the SQT’s functionalities, with the TEA Platform playing a crucial role in ensuring these enhancements adhere to the highest standards of fairness and ethical responsibility. Future updates will focus on expanding validation studies to encompass broader demographics, enhancing user training, and integrating user feedback more seamlessly into development cycles.

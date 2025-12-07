# Explainable Diabetic Retinopathy Screening System

| Field | Details |
|-------|---------|
| **Domain** | Healthcare |
| **Assurance Goal** | Explainability |

## Overview

The NHS Midlands Diabetic Eye Screening Programme has deployed an AI-powered system to assist in screening retinal images for signs of diabetic retinopathy (DR)—a complication of diabetes that damages blood vessels in the retina and can lead to vision loss if untreated. The system analyses fundus photographs (i.e. images of the back of the eye) to detect early signs of the condition, processing approximately 200,000 images annually across 50 screening locations.

Given that screening results directly affect patient care pathways, and determine whether patients are referred for specialist treatment or continue routine monitoring, the Programme has commissioned an assurance case. The focus of this case is to demonstrate that the system provides explanations that enable clinicians to understand, verify, and appropriately act on AI recommendations.

## System Description

### What the System Does

The Diabetic Retinopathy Screening System (DRSS) supports the NHS screening programme by:

- Analysing digital fundus photographs for signs of diabetic retinopathy
- Classifying images according to the NHS grading scheme (e.g. R0-R3 for retinopathy severity, M0-M1 for maculopathy)
- Generating visual explanations highlighting areas of concern
- Providing confidence scores and uncertainty estimates
- Flagging cases requiring urgent specialist review

### How It Works

During a routine diabetic eye screening appointment:

1. **Image Capture**: A trained screener captures fundus photographs of both eyes using a digital retinal camera
2. **Image Quality Assessment**: The system first evaluates whether image quality is sufficient for reliable analysis
3. **Feature Detection**: A deep learning model identifies relevant clinical features: microaneurysms (tiny bulges in blood vessels), haemorrhages (bleeding), exudates (fatty deposits), and neovascularisation (abnormal new blood vessel growth)
4. **Severity Classification**: Based on detected features, the system assigns a grade according to [NHS grading criteria](https://www.gov.uk/government/publications/diabetic-eye-screening-retinal-image-grading-criteria)
5. **Explanation Generation**: The system produces visual attention maps (highlighting which image regions influenced the decision) and natural language explanations
6. **Clinical Review**: A qualified grader reviews the AI output alongside the images and makes the final grading decision

### Key Technical Details

| Aspect | Details |
|--------|---------|
| **Model Architecture** | EfficientNet-B4 (a neural network optimised for image classification) with attention mechanism (highlighting influential image regions) for explanation generation |
| **Training Data** | 500,000 graded retinal images from UK screening programmes with expert consensus labels |
| **Input** | Two fundus photographs per eye (macula-centred and disc-centred views) |
| **Output** | Grade (R0-R3, M0-M1), confidence score (0-100%), attention heatmap, feature-level predictions, natural language summary |
| **Performance** | Sensitivity: 95.2%, Specificity: 89.7% for referable retinopathy (validated on held-out UK dataset) |
| **Explainability Methods** | [Grad-CAM](https://alan-turing-institute.github.io/tea-techniques/techniques/gradient-weighted-class-activation-mapping/) (gradient-weighted class activation mapping, showing which image regions most influenced the classification), attention visualisation, prototype-based reasoning (comparing to similar known cases) |
| **Validation** | Prospective clinical validation; quarterly performance monitoring; annual external audit |

### Deployment Context

- **Coverage**: Multiple screening programmes across NHS Midlands, serving populations in Birmingham, Coventry, Leicester, Nottingham, and Derby
- **Volume**: ~200,000 screening episodes annually
- **Patient Population**: Adults with Type 1 or Type 2 diabetes
- **Workflow Integration**: Embedded within existing grading workflow; all cases receive human review
- **Operational Since**: September 2023

## Stakeholders

| Stakeholder | Interest | Concern |
|-------------|----------|---------|
| **Patients** | Accurate screening and understandable results | Need to understand why they're being referred (or not) |
| **Screening Graders** | Reliable AI assistance that supports their expertise | Must understand AI reasoning to make informed decisions |
| **Ophthalmologists** | Appropriate referrals with relevant clinical context | Need explanations that inform treatment planning |
| **Programme Managers** | Efficient screening with maintained quality | Balance throughput with clinical safety |
| **MHRA** | Safe and effective medical device operation | Regulatory compliance and post-market surveillance |
| **NHS England** | National screening programme integrity | Consistent standards across all centres |

## Regulatory Context

The system operates within several regulatory frameworks:

- **UK Medical Devices Regulations 2002**: DRSS is classified as a Class IIa medical device requiring CE/UKCA marking
- **MHRA Guidance on AI as a Medical Device**: Requirements for clinical evidence, post-market surveillance, and transparency
- **NHS Diabetic Eye Screening Programme Standards**: National standards for screening quality and grading accuracy
- **NICE Guidance**: Evidence requirements for AI in diagnostic pathways
- **UK GDPR**: Special category health data processing requirements; data protection impact assessment required
- **Duty of Candour**: Healthcare providers must be open with patients about their care

## Explainability Considerations

Several aspects of this system require careful attention to explainability:

### Clinical Decision Support

Graders must understand why the AI has assigned a particular grade to make informed decisions. A simple classification without reasoning could lead to over-reliance or inappropriate dismissal of AI recommendations.

### Multiple Audiences

Explanations must serve different users with different needs:
- **Graders** need technical detail about detected features and their locations
- **Ophthalmologists** need clinically relevant information for treatment planning
- **Patients** need accessible explanations of their results

### Uncertainty Quantification and Communication

The system must clearly communicate when it is uncertain, enabling graders to apply additional scrutiny to borderline cases rather than treating all AI outputs with equal confidence.

### Feature Attribution Accuracy

Visual explanations (heatmaps) must accurately reflect the regions the model used for its decision. Misleading explanations could be worse than no explanation at all.

### Edge Cases and Limitations

The system must clearly indicate when images or cases fall outside its reliable operating envelope, such as unusual pathology, poor image quality, or rare presentations.

## Assurance Focus

The assurance case should demonstrate that:

> **The Diabetic Retinopathy Screening System provides explanations that enable qualified graders to understand, verify, and appropriately act on AI recommendations for patient care.**

### Deliberative Prompts

- What makes an explanation "good enough" for a clinical decision, and who decides?
- How do you balance explanation detail against the time pressures of high-volume screening?
- When an explanation is technically accurate but clinically misleading, whose responsibility is the resulting harm?
- How should uncertainty be communicated without undermining trust in the system or encouraging graders to ignore it?
- What do patients need to understand about AI involvement in their care, and when should this be disclosed?

## Suggested Strategies

When developing your assurance case, consider these potential approaches:

### Strategy 1: Explanation Fidelity

Ensure that visual and textual explanations accurately represent the model's actual reasoning process, so that clinicians are not misled about why a particular recommendation was made.

### Strategy 2: Clinical Workflow Integration

Design explanations that fit naturally within graders' existing decision-making processes, providing the right information at the right time without creating cognitive overload or workflow disruption.

### Strategy 3: Uncertainty and Limitation Communication

Develop clear, calibrated ways of communicating model confidence and indicating when the system is operating outside its reliable envelope, enabling graders to appropriately modulate their scrutiny and know when to exercise additional caution or seek alternative assessment.

### Strategy 4: Audience-Appropriate Explanations

Create explanation formats tailored to the distinct needs of graders, ophthalmologists, and patients, ensuring each group receives information they can understand and act upon.

## Recommended Techniques for Evidence

The following techniques from the [TEA Techniques library](https://alan-turing-institute.github.io/tea-techniques/techniques/) may be useful when gathering evidence for this assurance case:

- [Gradient-weighted Class Activation Mapping (Grad-CAM)](https://alan-turing-institute.github.io/tea-techniques/techniques/gradient-weighted-class-activation-mapping/) - Generate visual heatmaps showing which regions of the retinal image most influenced the classification decision
- [Saliency Maps](https://alan-turing-institute.github.io/tea-techniques/techniques/saliency-maps/) - Provide pixel-level attribution showing which parts of the image the model considers most relevant for its prediction
- [Conformal Prediction](https://alan-turing-institute.github.io/tea-techniques/techniques/conformal-prediction/) - Produce calibrated confidence intervals for predictions, enabling graders to understand when the model is uncertain

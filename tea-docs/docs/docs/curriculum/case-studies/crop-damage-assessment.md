# Fair Crop Damage Assessment System

![Crop Damage Assessment Hero Image](/img/case-studies/crop-damage-assessment.jpeg)

| Field | Details |
|-------|---------|
| **Domain** | Agricultural Finance |
| **Assurance Goal** | Fairness |

## Overview

AgriSure Insurance Ltd has developed an AI-powered crop damage assessment system to streamline the processing of agricultural insurance claims. The system analyses satellite and drone imagery to estimate crop damage percentages following adverse weather events, processing approximately 15,000 claims annually worth over £200 million in potential payouts across the UK.

After receiving complaints from small-scale farmers who believe their claims are being systematically undervalued compared to large agricultural operations, AgriSure has commissioned an assurance case to demonstrate that the system treats all farmers fairly regardless of farm size, crop type, or geographic location.

## System Description

### What the System Does

The Crop Damage Assessment System (CDAS) automates the initial assessment of crop damage claims by:

- Analysing pre-event and post-event satellite imagery to detect crop health changes
- Processing farmer-submitted drone footage for detailed damage assessment
- Estimating damage percentages for different areas within a field
- Generating preliminary payout recommendations based on policy terms
- Flagging complex cases for human adjuster review

### How It Works

When a farmer submits a claim following a weather event (hail, flood, drought, frost), the system:

1. **Retrieves Baseline Imagery**: Accesses historical satellite imagery showing pre-event crop conditions using vegetation indices such as NDVI and NDRE (measurements derived from satellite imagery that indicate plant health based on how crops reflect different wavelengths of light)
2. **Analyses Post-Event Imagery**: Processes satellite imagery captured after the reported event, comparing vegetation health indicators
3. **Drone Footage Processing**: If provided, analyses high-resolution drone imagery using semantic segmentation (a computer vision technique that classifies each pixel in an image to identify and outline damaged areas)
4. **Damage Estimation**: A regression model (a statistical method that predicts numerical values) estimates damage percentage (0-100%) for each field section
5. **Payout Calculation**: Applies policy terms (deductibles, coverage limits, crop values) to generate recommended payout
6. **Confidence Assessment**: Flags low-confidence assessments for human review

### Key Technical Details

| Aspect | Details |
|--------|---------|
| **Model Architecture** | U-Net (a neural network designed for image segmentation) for damage detection; XGBoost (a decision-tree-based prediction algorithm) for damage percentage estimation |
| **Training Data** | 50,000 labelled field images with expert damage assessments; 5 years of claims history with outcomes |
| **Input Features** | Pre/post vegetation index change, field size, crop type, weather event severity, regional growing conditions, policy details |
| **Satellite Sources** | Sentinel-2 (10m resolution, publicly available European Space Agency imagery), Planet Labs (3m resolution, commercial provider) |
| **Output** | Damage percentage per field section, confidence score, recommended payout, flagging decision |
| **Validation** | Monthly comparison with human adjuster assessments; annual actuarial review |
| **Explainability** | Damage heatmaps (colour-coded overlays showing damage severity) on imagery; feature importance rankings for each assessment |

### Deployment Context

- **Coverage**: Agricultural policies across England, Wales, and Scotland
- **Claim Volume**: ~15,000 claims annually, with peaks during summer storm season
- **Processing Time**: Initial assessment within 48 hours of imagery availability
- **Human Oversight**: 30% of claims receive additional human adjuster review
- **Operational Since**: January 2024

## Stakeholders

| Stakeholder | Interest | Concern |
|-------------|----------|---------|
| **Small-Scale Farmers** | Fair compensation for crop losses | May lack resources to challenge assessments; diverse or novel crop patterns harder to assess |
| **Large Agricultural Operations** | Efficient claims processing | Complex multi-field claims may require different treatment |
| **Insurance Adjusters** | Accurate preliminary assessments | Need to trust AI recommendations while maintaining oversight |
| **AgriSure Management** | Reduce claims processing costs while maintaining customer trust | Balance efficiency with fairness and accuracy |
| **Farming Unions (NFU, NFU Scotland)** | Ensure members receive fair treatment | Represent collective interests of diverse farming operations across the UK |
| **Financial Conduct Authority** | Fair treatment of insurance customers | Regulatory oversight of claims handling practices |

## Regulatory Context

The system operates within several regulatory frameworks:

- **Financial Conduct Authority (FCA) Principles**: PRIN 6 (treating customers fairly) and PRIN 12 (Consumer Duty) require fair outcomes for all customers
- **Equality Act 2010**: Prohibits discrimination in service provision, relevant if farm characteristics correlate with protected characteristics
- **UK GDPR**: Governs processing of farmer data; Article 22 provides rights regarding automated decision-making with legal effects
- **Insurance Act 2015**: Establishes duty of fair presentation and good faith in insurance contracts
- **FCA Insurance Conduct of Business Sourcebook (ICOBS)**: Specific rules on claims handling

## Fairness Considerations

Several aspects of this system raise fairness concerns:

### Farm Size Bias

The system was primarily trained on imagery from large, uniform monoculture fields where damage patterns are clearer. Smaller farms with diverse crops, irregular field shapes, or mixed planting may produce less confident assessments that systematically underestimate damage.

### Satellite Resolution Limitations

The 10-metre resolution of freely available Sentinel-2 imagery may be insufficient for accurately assessing small fields or patchy damage patterns. Larger operations may benefit from averaging effects that smooth out assessment errors.

### Crop Type Representation

Training data may over-represent common crops (wheat, barley, oilseed rape) while underrepresenting specialty crops, organic operations, or mixed farming systems, leading to less accurate assessments for diverse farming practices.

### Geographic Variation

Regional differences in growing conditions, soil types, and typical damage patterns may not be equally represented in training data, potentially disadvantaging farmers in underrepresented regions.

### Technology Access

Farmers who can provide high-resolution drone imagery receive more detailed assessments. This creates potential disparity between those who can afford drone technology and those relying solely on satellite imagery.

## Assurance Focus

The assurance case should demonstrate that:

> **The Crop Damage Assessment System fairly evaluates insurance claims across all farmers, without systematic disadvantage based on farm size, crop type, geographic location, or technology access.**

### Deliberative Prompts

- What does "fair" mean in the context of automated insurance claim assessment, and who gets to define it?
- How might historical patterns in agricultural insurance perpetuate or challenge existing inequalities?
- What tensions exist between efficiency gains from automation and the need for individualised assessment?
- When should a farmer's claim be escalated from automated to human review, and who bears the burden of requesting this?
- How would you know if the system was being unfair, and to whom would this be visible?

## Suggested Strategies

When developing your assurance case, consider these potential approaches:

### Strategy 1: Equitable Accuracy

Demonstrate that the system achieves comparable assessment accuracy across different farm types, sizes, and regions, accounting for the inherent differences in how damage manifests across diverse agricultural contexts.

### Strategy 2: Data Quality Parity

Ensure that limitations in input data quality (satellite resolution, coverage gaps, historical records) do not systematically disadvantage particular groups of farmers, with appropriate accommodations where data quality varies.

### Strategy 3: Accessible Appeals

Establish mechanisms through which farmers can meaningfully challenge assessments they believe to be unfair, with processes that do not require technical expertise or significant resources to navigate.

### Strategy 4: Ongoing Fairness Monitoring

Implement systematic monitoring of assessment outcomes across farmer demographics to detect emerging patterns of disadvantage and enable corrective action before harm accumulates.

## Recommended Techniques for Evidence

The following techniques from the [TEA Techniques library](https://alan-turing-institute.github.io/tea-techniques/techniques/) may be useful when gathering evidence for this assurance case:

- [Demographic Parity Assessment](https://alan-turing-institute.github.io/tea-techniques/techniques/demographic-parity-assessment/) - Evaluate whether damage assessments and payout rates are consistent across farm sizes, crop types, and geographic regions
- [Counterfactual Fairness Assessment](https://alan-turing-institute.github.io/tea-techniques/techniques/counterfactual-fairness-assessment/) - Test whether assessment outcomes would differ if farm characteristics (size, technology access) were changed while actual damage remained constant
- [Permutation Importance](https://alan-turing-institute.github.io/tea-techniques/techniques/permutation-importance/) - Identify which input features have the greatest influence on damage estimates, helping detect if potentially unfair proxies are driving predictions

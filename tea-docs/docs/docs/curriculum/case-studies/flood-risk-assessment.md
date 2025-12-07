# Equitable Flood Risk Assessment System

| Field | Details |
|-------|---------|
| **Domain** | Environmental Science |
| **Assurance Goal** | Fairness |

## Overview

The Thames Valley Water Authority has deployed an AI-powered flood risk assessment system to inform infrastructure investment decisions across the region. The system analyses multiple data sources to generate flood risk scores for over 2,000 communities, directly influencing how a £50 million annual budget is allocated for flood defences, drainage improvements, and emergency preparedness.

Following concerns raised by community advocates that historically underserved areas may be systematically disadvantaged by algorithmic risk assessment, the Authority has commissioned an assurance case to demonstrate that the system operates fairly across all communities.

## System Description

### What the System Does

The Flood Risk Assessment System (FRAS) produces quarterly risk scores for each community in the Thames Valley region. These scores range from 1 (minimal risk) to 10 (critical risk) and are calculated based on factors including terrain elevation, proximity to water bodies, drainage infrastructure capacity, and historical flood frequency. The scores are used to:

- Prioritise capital investment in flood defence infrastructure
- Allocate emergency response resources and equipment
- Determine eligibility for government flood resilience grants
- Inform insurance risk assessments shared with partner insurers

### How It Works

The system integrates data from multiple sources:

1. **Satellite Imagery Analysis**: A convolutional neural network (a type of AI model, commonly used to analyse visual imagery) processes monthly satellite imagery to detect changes in land use, vegetation cover, and surface water accumulation
2. **Hydrological Modelling**: Physics-based simulations of water flow patterns using terrain elevation data and historical rainfall records
3. **Infrastructure Data**: Information about existing drainage systems, flood barriers, and pumping stations
4. **Historical Flood Records**: 50 years of flood event data including severity, duration, and affected areas
5. **Socioeconomic Data**: Population density, property values, and critical infrastructure locations

An ensemble model (a system that combines multiple prediction methods) integrates these inputs to generate the final risk score, with a confidence interval and key contributing factors.

### Key Technical Details

| Aspect | Details |
|--------|---------|
| **Model Architecture** | Ensemble combining CNN (for satellite imagery analysis), gradient boosting (a decision-tree algorithm for structured data), and physics-based hydrological simulation |
| **Training Data** | 15 years of historical flood events (2008-2023), satellite imagery archive, national terrain models |
| **Input Features** | 27 features including terrain elevation, land use classification, drainage capacity, historical flood frequency, and proximity to water bodies |
| **Output** | Risk score (1-10), confidence interval, top 5 contributing factors from sensitivity analysis, trend indicator (improving/stable/worsening) |
| **Validation** | Quarterly back-testing against observed flood events; annual external audit |
| **Explainability** | SHAP values (a method for explaining which factors most influenced a prediction); natural language summaries from LLM agent for planners |

### Deployment Context

- **Coverage**: 2,147 communities across Oxfordshire, Berkshire, and Buckinghamshire
- **Update Frequency**: Risk scores updated quarterly; emergency re-assessment capability within 48 hours
- **Users**: Strategic planners, emergency response coordinators, grant administrators, and partner insurers
- **Operational Since**: March 2023

## Stakeholders

| Stakeholder | Interest | Concern |
|-------------|----------|---------|
| **Community Residents** | Receive appropriate flood protection | May be disadvantaged by biased risk assessment |
| **Local Councils** | Allocate resources effectively | Need confidence in risk score accuracy, transparency, and fairness |
| **Strategic Planners** | Make evidence-based investment decisions | Require transparent, defensible methodology |
| **Insurance Partners** | Set appropriate premiums | Need reliable, non-discriminatory risk data |
| **Community Advocates** | Ensure equitable treatment | Worry about historical bias affecting vulnerable communities |
| **Environmental Regulators** | Meet statutory flood protection duties | Require demonstrable fairness in resource allocation |

## Regulatory Context

The system operates within several regulatory frameworks:

- **Flood and Water Management Act 2010**: Establishes duties for flood risk management and requires consideration of all communities at risk
- **Equality Act 2010**: Prohibits discrimination in service provision; relevant where flood protection is considered a public service
- **UK GDPR**: Governs processing of location and demographic data; Article 22 rights regarding automated decision-making
- **Environment Agency Guidance**: National standards for flood risk assessment methodologies
- **Public Sector Equality Duty**: Requires public authorities to consider equality implications of their decisions

## Fairness Considerations

Several aspects of this system raise fairness concerns:

### Historical Bias

Past flood protection investments may have favoured wealthier areas, meaning historical flood data could reflect protective infrastructure rather than inherent risk. Communities that experienced fewer floods due to underinvestment (poor drainage leading to gradual waterlogging rather than dramatic floods) may be scored as lower risk.

### Data Quality Disparities

The 50 years of historical flood records vary significantly in quality and completeness across the region. Rural and less-monitored areas may have sparser data, with flood events going unrecorded or underreported. Similarly, satellite imagery resolution varies, potentially affecting risk score accuracy for different communities.

### Proxy Discrimination

Features such as property values, infrastructure age, and population density may correlate with socioeconomic status, potentially encoding historical inequalities into risk assessments.

### Feedback Loops

Communities that receive investment see improved infrastructure, potentially lowering future risk scores and creating self-reinforcing cycles of investment inequality.

## Assurance Focus

The assurance case should demonstrate that:

> **The Flood Risk Assessment System fairly evaluates flood risk across all communities, without systematic disadvantage to historically underserved or socioeconomically vulnerable areas.**

### Deliberative Prompts

- What does fairness mean when assessing risk? Equal accuracy, equal outcomes, or something else?
- How should a system account for historical underinvestment that has shaped the very data it learns from?
- When risk correlates with socioeconomic factors, how do you distinguish legitimate risk signals from discriminatory proxies?
- Who should have standing to challenge a community's risk assessment, and what evidence should they need?
- How might optimising for overall prediction accuracy conflict with equitable treatment of all communities?

## Suggested Strategies

When developing your assurance case, consider these potential approaches:

### Strategy 1: Bias Detection and Mitigation

Identify and address sources of historical and structural bias in training data and model features, ensuring that past inequalities in flood protection investment do not perpetuate future disadvantage.

### Strategy 2: Transparent Methodology

Enable communities and oversight bodies to understand how risk scores are calculated, which factors contribute most to their assessment, and how the methodology accounts for known limitations.

### Strategy 3: Meaningful Oversight and Appeals

Establish processes through which communities can challenge their risk assessments and access independent review, with community representation in governance structures.

### Strategy 4: Ongoing Fairness Monitoring

Track investment allocation patterns and risk score distributions over time to detect emerging disparities and ensure the system's fairness properties are maintained as conditions change.

## Recommended Techniques for Evidence

The following techniques from the [TEA Techniques library](https://alan-turing-institute.github.io/tea-techniques/techniques/) may be useful when gathering evidence for this assurance case:

- [Demographic Parity Assessment](https://alan-turing-institute.github.io/tea-techniques/techniques/demographic-parity-assessment/) - Evaluate whether risk scores and resulting investment allocations are distributed equitably across community demographics
- [Counterfactual Fairness Assessment](https://alan-turing-institute.github.io/tea-techniques/techniques/counterfactual-fairness-assessment/) - Test whether a community's risk score would change if its socioeconomic characteristics were different while physical flood risk factors remained the same
- [Sensitivity Analysis for Fairness](https://alan-turing-institute.github.io/tea-techniques/techniques/sensitivity-analysis-for-fairness/) - Assess how sensitive the model's predictions are to features that may act as proxies for protected characteristics

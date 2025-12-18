# Trustworthy & Ethical Assurance Platform

![An illustration representing the collaborative development of a structured assurance case. The image shows various groups of people working together across different workstations linked by different paths.](hero.gif)

[![Go to the TEA Platform](https://img.shields.io/badge/Go%20to%20the%20TEA%20Platform-0F76B8?style=flat&link=https://assuranceplatform.azurewebsites.net/)](https://assuranceplatform.azurewebsites.net/)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.8198986.svg)](https://doi.org/10.5281/zenodo.8198986)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## About this Repository 🗂

This repository contains the code and documentation for the Trustworthy and Ethical Assurance (TEA) platform—an application for building trustworthy and ethical assurance cases, developed by researchers at the [Alan Turing Institute](https://www.turing.ac.uk/) and [University of York](https://www.york.ac.uk/assuring-autonomy/).

### What is TEA? 🫖

The Trustworthy and Ethical Assurance (TEA) Platform is a collaborative tool for developing structured arguments about how ethical principles and trustworthy practices have been upheld throughout the lifecycle of data-driven technologies.

At its core, TEA helps multi-stakeholder project teams create **assurance cases**: structured, graphical representations that demonstrate how goals like fairness, explainability, safety, or sustainability have been achieved over the course of a project's lifecycle.

The platform addresses a fundamental challenge in responsible technology development: how can project teams provide **justified evidence** that ethical principles have been upheld?

TEA supports this through three integrated components:

1. An interactive tool for building assurance cases
2. A comprehensive framework of skills and capabilities resources
3. A collaborative community infrastructure that promotes open practices and shared learning in the trustworthy assurance ecosystem

### How to learn TEA? 🎓

Whether you're new to assurance cases or looking to deepen your expertise, our structured curriculum provides pathways for all skill levels:

- **TEA Trainee** — Start your journey with foundational concepts and hands-on exercises
- **TEA Specialist** — Develop advanced skills in building and reviewing assurance cases
- **TEA Expert** — Master the art of facilitating assurance processes across organisations

Explore the [TEA Curriculum](https://assuranceplatform.azurewebsites.net/docs/curriculum) to begin your learning journey.

### Developer Information 💻

The TEA Platform is a full-stack web application built with modern technologies:

- **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: NextAuth.js with GitHub OAuth and credentials
- **Visualisation**: React Flow for interactive assurance case diagrams

#### Quick Start

```bash
# Clone the repository
git clone https://github.com/alan-turing-institute/AssurancePlatform.git
cd AssurancePlatform

# Copy environment file and configure
cp .env.example .env.local

# Start the development environment
docker-compose -f docker-compose.development.yml up -d --build

# Access at http://localhost:3000
```

For detailed setup instructions, API documentation, and contribution guidelines, see our [Technical Documentation](https://assuranceplatform.azurewebsites.net/docs/technical-guide.

### Further Resources 📚

The following resources provide additional information about the Trustworthy and Ethical Assurance framework and methodology:

- Burr, C., Arana, S., Gould Van Praag, C., Habli, I., Kaas, M., Katell, M., Laher, S., Leslie, D., Niederer, S., Ozturk, B., Polo, N., Porter, Z., Ryan, P., Sharan, M., Solis Lemus, J. A., Strocchi, M., Westerling, K., (2024) Trustworthy and Ethical Assurance of Digital Health and Healthcare. [https://doi.org/10.5281/zenodo.10532573](https://doi.org/10.5281/zenodo.10532573)
- Porter, Z., Habli, I., McDermid, J. et al. A principles-based ethics assurance argument pattern for AI and autonomous systems. AI Ethics 4, 593–616 (2024). [https://doi.org/10.1007/s43681-023-00297-2](https://doi.org/10.1007/s43681-023-00297-2)
- Burr, C. and Powell, R., (2022) Trustworthy Assurance of Digital Mental Healthcare. The Alan Turing Institute [https://doi.org/10.5281/zenodo.7107200](https://doi.org/10.5281/zenodo.7107200)
- Burr, C., & Leslie, D. (2022). Ethical assurance: A practical approach to the responsible design, development, and deployment of data-driven technologies. AI and Ethics. [https://doi.org/10.1007/s43681-022-00178-0](https://doi.org/10.1007/s43681-022-00178-0)

### Funding Statements 💷

From March 2024 until September 2024, the project is funded by UKRI's [BRAID programme](https://braiduk.org/) as part of a scoping research award for the [Trustworthy and Ethical Assurance of Digital Twins](https://www.turing.ac.uk/research/research-projects/trustworthy-and-ethical-assurance-digital-twins-tea-dt) project.

Between April 2023 and December 2023, this project received funding from the Assuring Autonomy International Programme, a partnership between Lloyd’s Register Foundation and the University of York, which was awarded to Dr Christopher Burr.

Between July 2021 and June 2022 this project received funding from the UKRI’s Trustworthy Autonomous Hub, which was awarded to Dr Christopher Burr (Grant number: TAS_PP_00040).

TEA (Trustworthy & Ethical Assurance) Platform is a full-stack web application for creating and sharing structured assurance cases. Built with Next.js, React, TypeScript, and Prisma ORM.

## Contributing

Contributions are welcome! If you find any issues or have suggestions for improvements, feel free to open an issue or submit a pull request.

## Licence

This project is licensed under the MIT Licence. See the LICENCE file for details.

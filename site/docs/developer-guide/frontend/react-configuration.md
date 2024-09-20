# React Configuration

This document outlines the key configuration settings for the frontend of the Trustworthy and Ethical Assurance (TEA) Platform, a dynamic open-source tool developed to streamline the creation, management, and sharing of assurance cases. Our configuration aims to enhance usability and interactivity, ensuring a seamless experience for our users.

## Configuration Overview

The frontend configuration of the TEA Platform is centralized within the `config.json` file located at [`/frontend/src/config.json`](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/config.json). This file contains essential variables and settings that dictate how the frontend interacts with various elements of the platform, including the backend server, GitHub integration, and visual presentation of assurance cases.

To modify the TEA Platform's frontend configuration, simply edit the `config.json` file and adjust the variables as needed to suit your deployment environment or visual preference.

!!! warning

    Remember to review and test changes thoroughly to ensure optimal platform performance and user experience.

## Key Configuration Variables

`DEFAULT_BASE_URL`: Defines the base URL for backend API calls. By default, it points to `http://localhost:8000/api`, suitable for development environments. Adjust this URL to match your production backend deployment as necessary.

`DEFAULT_GITHUB_CLIENT_ID` and `DEFAULT_GITHUB_REDIRECT_URI`: Used for GitHub authentication, facilitating social login and repository integration. Customize these values based on your GitHub OAuth application settings.

`BOX_NCHAR`: Determines the character limit for text boxes within the platform, ensuring content consistency and readability.

`property_claim_types`: Lists the types of property claims supported by the platform, such as "Project claim" and "System claim", enabling users to categorize their claims accurately.

## Styling and Visualization

The styling and mermaid_styles sections define the visual appearance of the assurance case elements, applying to fonts, colors, and shapes within the platform's graphical representations. These styles are crucial for enhancing the visual clarity and distinction between different elements of an assurance case.

- `styling`: Specifies the main and Mermaid-specific fonts used throughout the platform, promoting a cohesive and accessible user interface.
- `mermaid_styles`: Configures the colors and styles for different assurance case elements when visualized using the Mermaid diagramming tool. This includes configurations for various themes such as default, inverted, white, high-contrast, and monochrome, allowing for personalized visualization preferences.

## Navigation Hierarchy

The navigation object defines the hierarchical structure and relationships between different types of assurance case elements (e.g., `AssuranceCase`, `TopLevelNormativeGoal`, `Context`). It outlines how these elements are accessed and manipulated via the API, facilitating the dynamic construction and navigation of assurance cases within the platform.

<!--
TODO: Suggested Screenshots for this page

Screenshot of the config.json file: An image showing the contents of the configuration file, highlighting the structure and key variables.

Dashboard with Configured Base URL: A dashboard view of the TEA Platform, indicating how the DEFAULT_BASE_URL affects the interaction with the backend.

Assurance Case Visualization: Examples of assurance cases visualized using different mermaid_styles, showcasing the impact of styling configurations on case presentation.

GitHub Integration Settings: A screenshot showing the GitHub authentication settings within the platform's interface, reflecting the DEFAULT_GITHUB_CLIENT_ID and DEFAULT_GITHUB_REDIRECT_URI configurations.

Navigation Hierarchy Visualization: A diagram or interface snapshot illustrating the navigation hierarchy as defined in the navigation object, demonstrating the platform's object management and API interaction logic.
-->

# React Components Deep Dive

Explore the intricacies of the React components that power the user interface of the Trustworthy and Ethical Assurance (TEA) Platform. This exploration delves into the custom-built and modular components that form the backbone of the platform's frontend, shedding light on their properties (props), internal states, and functional roles. Gain insights into the contribution of each component towards crafting a seamless and intuitive user experience, and understand the mechanics behind the platform's operational flow.

Each component is meticulously designed to fulfill specific functions within the TEA Platform, from case creation and selection to detailed visualization and editing. Together, they embody the platform's commitment to making assurance case management an accessible, transparent, and collaborative process.

!!! warning

    This section is a work in progress and will be updated with detailed information about the React components in the TEA Platform frontend, pending docstring writing and code review.

---

## [`Routes`](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/Routes.js)

The `Routes` component acts as the central dispatcher for the application's various screens or views. It listens to changes in the browser's URL and mounts the appropriate React component that corresponds to the current route. This mechanism is crucial for the TEA Platform, allowing users to navigate between different parts of the application—such as creating a new assurance case, viewing a list of cases, or editing a specific case—without the traditional overhead associated with full-page refreshes.

## [`CaseContainer`](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/CaseContainer.js)

Serves as the primary container for displaying and interacting with an assurance case. It integrates various components like `MermaidChart`, `ItemEditor`, and `CaseTopBar` to provide a comprehensive view and editing capabilities of an assurance case.

## [`CaseCreator`](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/CaseCreator.js) and [`CaseCreatorFlow`](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/CaseCreatorFlow.jsx)

These components manage the creation of new assurance cases. Users can either start from scratch or use predefined templates to define the structure and content of their assurance cases.

## [`CommentSection`](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/CommentSection.js)

Facilitates adding, viewing, and managing comments within an assurance case. It encourages collaborative review and feedback among users.

## [`CreateGroup`](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/CreateGroup.js)

Enables users to create new user groups for managing access and permissions across different assurance cases, fostering collaborative environments.

## [`DeleteCaseModal`](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/DeleteCaseModal.jsx) and [`DeleteItemModal`](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/DeleteItemModal.jsx)

These modals handle the deletion of assurance cases and individual items within a case, ensuring users are aware of the irreversible nature of this action through confirmatory prompts.

## [`ExportCaseModal`](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/ExportCaseModal.jsx)

Provides functionality for exporting assurance cases in various formats, supporting the sharing and external review of cases.

## [`ManageCases`](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/ManageCases.js)

Acts as the dashboard for users to access, manage, and create new assurance cases. It includes quick access to import, create, and view existing cases.

## [`Navigation`](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/Navigation.js)

The navigation bar at the top of the platform, offering easy access to the main sections of the application, GitHub repository, and user authentication actions.

## [`Splash`](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/Home.js) and [`Home`](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/Home.js)

`Splash` serves as the landing page for new or unauthenticated users, guiding them through login or case creation. `Home` transitions authenticated users to the `ManageCases` view, signifying entry into the case management dashboard.

<!--
[**`CaseContainer`**](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/CaseContainer.js): The central hub of the assurance case visualization, this component orchestrates the display of assurance cases by dynamically rendering various sub-components based on the application's state. It also processes the JSON from assurance case API responses into markdown for visualization.

[**`CaseSelector`**](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/CaseSelector.js): Functions as an interactive drop-down menu, enabling users to navigate through and select assurance cases stored in the database for viewing or editing.

[**`CaseCreator`**](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/CaseCreator.js): A user-friendly form component that facilitates the creation of new assurance cases by submitting data to the corresponding API endpoint.

[**`ItemViewer`**](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/ItemViewer.js): Specialized for displaying details of database objects associated with an assurance case, such as goals, contexts, and claims. It reveals the complexity of assurance cases in a digestible text format.

[**`ItemEditor`**](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/ItemEditor.js): Activated via the "Edit" action in the `ItemViewer`, this component allows for in-depth modification of assurance case elements, enriching the platform's interactive editing capabilities.

[**`ItemCreator`**](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/ItemCreator.js): Emerges within the `CaseContainer` to assist users in constructing new elements (e.g., goals, contexts) as direct descendants of the currently edited object, further enhancing the case-building process.

[**`Mermaid`**](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/Mermaid.js): Employs the Mermaid library to render graphical representations of assurance cases, transforming markdown into visually engaging diagrams that elucidate the structure and relationships within a case. Read more about it [here](mermaid.md).

[**`Home`**](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/Home.js): The starting point of the application, offering straightforward navigation to essential components like the `CaseCreator` and `CaseSelector`, welcoming users into the world of assurance case management.

[**`Routes`**](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/components/Routes.js): Defines the navigational structure of the application, ensuring smooth transitions between the home page, case creation, selection, and detailed case view components, facilitating a cohesive user journey through the platform.
-->
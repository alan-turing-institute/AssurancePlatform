# Reactflow

React Flow is a library for building interactive node-based applications using React. It provides a simple API for creating flows, diagrams, and custom workflows. React Flow is especially useful for visualizing data relationships and building complex interfaces where users can manipulate nodes and edges.

## Key Features of React Flow

- **Node and Edge Management**: Easily manage nodes and edges with a straightforward API.
- **Customizable Components**: Create custom nodes and edges to fit specific use cases.
- **Zoom and Pan**: Supports zooming and panning, allowing users to navigate complex diagrams effortlessly.
- **Interactive**: Provides drag-and-drop functionality for a more interactive user experience.
- **Flexible Layouts**: Supports different layouts for nodes, enabling various design patterns.

!!! warning

    This section is a work in progress and will be updated with detailed information about the React components in the TEA Platform frontend, pending docstring writing and code review.

---

### Example Assurance Case
Here is an example of how an assurance case can look when rendered with ReactFlow.

![Assurance Case Example](https://staging-assuranceplatform.azurewebsites.net/images/tea-chart.png)

### How is the chart rendered?

This chart is fairly static, in that the user cannot move each of the elements around the screen. Although, ReactFlow does provide this feature, we decided to lock this down for our intial release.

To move elements you can use the actions presented when selecting an element.

# Assurance Platform frontend

The frontend web application for the Assurance Platform project was built using
the [React](https://reactjs.org/) framework. Documentation on various npm and
react commands can be found [here](react_info.md).

## Installing and running the code for development

From this directory, run

```
npm install
```

and then to install the required dependencies,

```
npm start
```

to run the development server (will open a browser tab at `localhost:3000`), and

```
npm run test
```

to run the tests.

## Mermaid

A crucial aspect of the Assurance Platform is the visualization of an assurance
case, which we do using the [Mermaid](https://mermaid-js.github.io/mermaid/#/)
package. This takes some markdown text and displays it as a flowchart. It is
possible to experiment with Mermaid, interactively creating flowcharts via the
live editor [https://mermaid.live/](https://mermaid.live/).

## Description of some components

The react framework is based around _Components_, which can correspond to a
webpage or an element on a webpage (such as a form or a chart). The following
Components in this codebase contribute to the Assurance Platform web app:

- [CaseContainer](src/components/CaseContainer.js): this is the main "view" of
  an assurance case. It contains several other components in different areas of
  the screen (these may or may not be visible, depending on the state variables
  that control whether some _layers_ are shown or not).
- [CaseCreator](src/components/CaseCreator.js). A modal that allows a user to
  create a new AssuranceCase, and POSTs it to the API endpoint that then adds it
  to the database. The user can start from templates or import existing cases.
- [CaseTopBar](src/components/CaseTopBar.jsx). The top later of the case container, with controls for editing the assurance case itself.
- [ItemEditor](src/components/ItemEditor.js) The layer containing the ItemEditor
  component is shown when an element on the chart is clicked. This
  component allows the details of any DB object other than an AssuranceCase to
  be edited.
- [Layout](src/components/common/Layout.jsx) Contains layouts used by multiple pages.
- [Manage cases](src/components/ManageCases.jsx) This is the home page for a logged in user. It allows them to see a list of their existing cases, or to create new ones.
- [Mermaid](src/components/Mermaid.js) This is the component that draws the
  actual chart. The markdown for the chart is passed to the component via the
  `chartmd` prop. It is also responsible for turning the case JSON into markdown.
- [Home](src/components/Home.js) Very basic homescreen.
- [Routes](src/components/Routes.js) Define routes for the homepage, the
  ManageCases, CaseSelector, and CaseContainer components.
- [Theming](src/Theming.jsx) Used to style material ui components across the entire app.

## Configuration

Several useful variables are defined in [config.json](src/config.json),
including:

- _BASE_URL_: this is the base URL for the backend, which by default is setup to
  look at a locally running Django backend on `localhost:8000`. If you use a
  real deployment of the backend, change this variable accordingly.
- _navigation_ This defines the hierarchy of different types of objects, and how
  they can be accessed via the API.

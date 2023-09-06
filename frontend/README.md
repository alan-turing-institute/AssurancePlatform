# Assurance Platform frontend

The frontend web application for the Assurance Platform project was built using
the [React](https://reactjs.org/) framework. Documentation on various npm and
react commands can be found [here](react_info.md).

## Installing and running the code for development

From this directory, run

```
npm install
```

to install the required dependencies,

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
  that control whether some _layers_ are shown or not). This class also contains
  the function that converts the JSON obtained from a GET request to the
  `cases/<case_id>` API endpoint, into the markdown string that is used by
  Mermaid.
- [CaseSelector](src/components/CaseSelector.js). Essentially a drop-down menu
  that allows the user to select which case to load from the database.
- [CaseCreator](src/components/CaseCreator.js). A form that allows a user to
  create a new AssuranceCase, and POSTs it to the API endpoint that then adds it
  to the database.
- [ItemViewer](src/components/ItemViewer.js) Text view of any DB object other
  than an AssuranceCase (i.e. it could be a TopLevelNormativeGoal, Context,
   PropertyClaim, Argument, EvidentialClaim, or Evidence). The
  type of object to be displayed is passed to the component via the "type" prop.
  The component itself is shown as a layer on CaseContainer when a node on the
  mermaid chart is clicked.
- [ItemEditor](src/components/ItemEditor.js) The layer containing the ItemEditor
  component is shown when the "Edit" button on an ItemViewer is clicked. This
  component allows the details of any DB object other than an AssuranceCase to
  be edited.
- [ItemCreator](src/components/ItemCreator.js) This component is shown in the
  createLayer in CaseContainer, when a "Create a new XYZ" button is clicked on
  the ItemEditor. It will create a new DB object of the specified type, which is
  a child of the object that was visible in the ItemEditor.
- [Mermaid](src/components/Mermaid.js) This is the component that draws the
  actual chart. The markdown for the chart is passed to the component via the
  `chartmd` prop.
- [Home](src/components/Home.js) Very basic homescreen containing navigation
  options to the CaseCreator and CaseSelector.
- [Routes](src/components/Routes.js) Define routes for the homepage, the
  CaseCreator, CaseSelector, and CaseContainer components.

## Configuration

Several useful variables are defined in [config.json](src/config.json),
including:

- _BASE_URL_: this is the base URL for the backend, which by default is setup to
  look at a locally running Django backend on `localhost:8000`. If you use a
  real deployment of the backend, change this variable accordingly.
- _navigation_ This defines the hierarchy of different types of objects, and how
  they can be accessed via the API.

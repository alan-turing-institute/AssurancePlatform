# About the Platform

!!! info "About the Platform"

    This page contains further information about the platform, including details about the frontend and backend.

## Frontend

The frontend web application for the Assurance Platform project was built using
the [React](https://reactjs.org/) framework. Documentation on various npm and
react commands can be found [here](react_info.md).

### Installing and running the code for development

From the `/frontend` directory, run:

```shell
npm install
```

to install the required dependencies,

```shell
npm start
```

to run the development server (will open a browser tab at `localhost:3000`), and

```shell
npm run test
```

to run the tests.

### Mermaid

A crucial aspect of the Assurance Platform is the visualization of an assurance
case, which we do using the [Mermaid](https://mermaid-js.github.io/mermaid/#/)
package. This takes some markdown text and displays it as a flowchart. It is
possible to experiment with Mermaid, interactively creating flowcharts via the
live editor [https://mermaid.live/](https://mermaid.live/).

### Description of some components

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
  SystemDescription, PropertyClaim, Argument, EvidentialClaim, or Evidence). The
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

### Configuration

Several useful variables are defined in
[/frontend/src/config.json](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/frontend/src/config.json),
including:

- _BASE_URL_: this is the base URL for the backend, which by default is setup to
  look at a locally running Django backend on `localhost:8000`. If you use a
  real deployment of the backend, change this variable accordingly.
- _navigation_: This defines the hierarchy of different types of objects, and
  how they can be accessed via the API.

## Backend

[![Coverage Status](https://coveralls.io/repos/github/alan-turing-institute/AssurancePlatform/badge.svg?branch=main)](https://coveralls.io/github/alan-turing-institute/AssurancePlatform?branch=main)

The backend is written in the [Django](https://docs.djangoproject.com/en/4.0/)
framework. Its main purpose is to provide an API, through which data can be
written to, retrieved from, or edited in, a database.

Documentation on the API endpoints can be found [here](eap_api/API_docs.md).

The database itself can be any SQL-based technology—the most straightforward to
use being:

- SQLite: this is the out-of-the-box default, useful for testing and development
- Postgresql: see below for instructions on how to deploy this on Azure cloud.

### Settings

Most useful settings are in the file
[eap_backend/settings.py](eap_backend/settings.py).

Some useful variables are:

- `SECRET_KEY`: you should use your secret key here when running in production,
  and keep it out of version control.
- `CORS_ORIGIN_WHITELIST`: ensure that you have the host/port of your frontend
  added to this list (if running the React frontend in this repository on your
  local machine, this will be `localhost:3000`, which is already added).
- Database settings: if the environment variable `DBHOST` is not set, the
  database used will be a local sqlite file `db.sqlite3`. However, if `DBHOST`
  is set, you should also set `DBNAME`, `DBUSER` and `DBPASSWORD` as appropriate
  for your postgres server.
  - We suggest "eap" for `DBNAME`.
  - Note that `DBUSER` should include `@<dbhostname>`, so for example, if we
    have `DBHOST=eapdb.postgres.database.azure.com`, we might have
    `DBUSER=db_admin@eapdb`.
  - Ensure that you keep any secrets out of version control.

### Running locally

Before running the first time, or after making any changes to the database
schema, run the command:

```shell
python manage.py migrate
```

To run the API, just run the command:

```shell
python manage.py runserver
```

from the `eap_backend` directory.

### Running tests

```shell
python manage.py test
```

### Description of the code

In common with many projects using Django / Django REST framework, some of the
relevant python modules are:

- [eap_api/models.py](eap_api/models.py): this essentially defines the database
  schema (via Django's Object Relational Model, where a class inheriting from
  `django.db.models.Model` corresponds to a database table).
- [eap_api/serializers.py](eap_api/serializers.py): this describes how
  django-rest-framework converts the Model instances into JSON and vice versa.
- [eap_api/views.py](eap_api/views.py): here, in addition to some helper
  functions, there is one function per API endpoint, defining how the
  serializers are used to produce or parse JSON data in response to different
  REST verbs. One complication here is that we want a GET request for specific
  cases to return the full nested JSON including all children. This makes use of
  the recursive `get_json_tree` function.
- [eap_api/urls.py](eap_api/urls.py: this provides the connections between API
  endpoints and the functions defined in `views.py`.

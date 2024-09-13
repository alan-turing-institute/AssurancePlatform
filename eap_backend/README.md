# The Ethical Assurance Platform backend

[![Coverage Status](https://coveralls.io/repos/github/alan-turing-institute/AssurancePlatform/badge.svg?branch=main)](https://coveralls.io/github/alan-turing-institute/AssurancePlatform?branch=main)

The backend is written in the [Django](https://docs.djangoproject.com/en/4.0/)
framework. Its main purpose is to provide an API, through which data can be
written to, retrieved from, or edited in, a database.

Documentation on the API endpoints can be found [here](eap_api/API_docs.md).

The database itself can be any SQL-based technology - the most straightforward
to use being:

- SQLite - this is the out-of-the-box default, useful for testing and
  development
- Postgresql - see below for instructions on how to deploy this on Azure cloud.

## Settings

Most useful settings are in the file
[eap_backend/settings.py](eap_backend/settings.py). Some useful variables are:

- `SECRET_KEY` - you should use your secret key here when running in production,
  and keep it out of version control.
- `CORS_ORIGIN_WHITELIST` - ensure that you have the host/port of your frontend
  added to this list (if running the React frontend in this repository on your
  local machine, this will be `localhost:3000`, which is already added).
- Database settings - if the environment variable `DBHOST` is not set, the
  database used will be a local sqlite file `db.sqlite3`. However, if `DBHOST`
  is set, you should also set `DBNAME`, `DBUSER` and `DBPASSWORD` as appropriate
  for your postgres server.
  - We suggest "eap" for `DBNAME`.
  - Note that `DBUSER` should include `@<dbhostname>`, so for example, if we
    have `DBHOST=eapdb.postgres.database.azure.com`, we might have
    `DBUSER=db_admin@eapdb`.
  - Ensure that you keep any secrets out of version control.

## Running locally

Before running the first time, or after making any changes to the database
schema, run the command:

```
python manage.py migrate
```

To run the API, just run the command:

```
python manage.py runserver
```

from this directory. If you want to also test websocket support, please run:

```
uvicorn --host 0.0.0.0 eap_backend.asgi:application
```

## Running tests

```
python manage.py test
```

## Description of the code

In common with many projects using Django / Django REST framework, some of the
relevant python modules are:

- [eap_api/models.py](eap_api/models.py) - this essentially defines the database
  schema (via Django's Object Relational Model, where a class inheriting from
  `django.db.models.Model` corresponds to a database table).
- [eap_api/serializers.py](eap_api/serializers.py) - this describes how
  django-rest-framework converts the Model instances into JSON and vice versa.
- [eap_api/views.py](eap_api/views.py) - here, in addition to some helper
  functions, there is one function per API endpoint, defining how the
  serializers are used to produce or parse JSON data in response to different
  REST verbs. One complication here is that we want a GET request for specific
  cases to return the full nested JSON including all children. This makes use of
  the recursive `get_json_tree` function.
- [eap_api/urls.py](eap_api/urls.py) - this provides the connections between API
  endpoints and the functions defined in `views.py`.

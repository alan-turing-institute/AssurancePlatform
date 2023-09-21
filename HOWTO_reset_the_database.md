There are a couple of reasons why one might wish to remove the contents of the
AssurancePlatform database and recreate a fresh one:

- After a workshop or demo session, may want to remove all users and created
  cases.
- You (or someone) has made some non-migratable schema changes in the code. How
  to do this depends on whether you are running locally, or on a
  cloud-deployment (such as having followed the instructions for deploying on
  Azure [here](HOWTO_deploy_to_Azure.md)).

## Running on your local machine

Unless you have changed some settings, you will likely be using a local `sqlite`
file for your database. To remove it, simply remove the file
`eap_backend/db.sqlite3`. Then run (having setup the environment for the backend
following the instructions [here](README.md)) the commands:

```python manage.py makemigrations

```

```
python manage.py migrate
```

and next time you run the backend, you should have a new sqlite file with an
empty database.

## Running on Azure

To delete and recreate the database on an Azure deployment, it is necessary to
connect to it using something like `psql` (as described
[here](HOWTO_deploy_to_Azure.md)).

1. If you haven't already done this when setting up, ensure that your IP address
   can connect to the database server. Via the Azure portal, find your database
   resource, and click on "Connection security" in the left sidebar, click "Add
   current client IP address", and save.
2. If you don't already have it, install `psql`. For Mac/Homebrew,
   `brew install postgresql` should work. For other OSs, Google is available :)
3. drop and recreate the database via psql.

```psql --host=SERVER_NAME.postgres.database.azure.com --port=5432 --username=ADMIN_USERNAME@SERVER_NAME --dbname=postgres
postgres=> DROP DATABASE eap;
postgres=> CREATE DATABASE eap;
postgres=> \c eap;
postgres=> \q
```

where `SERVER_NAME`, `ADMIN_USERNAME`, and the admin password should all be
available via the Azure portal (password may be stored in a keyvault). 4. In the
Azure portal, find the Web app for the backend, and restart it. After a few
minutes, everything should be back up and running.

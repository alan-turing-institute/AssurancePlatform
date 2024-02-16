# Resetting the Database on Local Deployments

Resetting your local database involves a straightforward process that ensures you start afresh with your TEA Platform's backend. This guide is designed for local deployments using SQLite, the default database setup for development environments.

!!! warning

    This process will remove all existing data in the database. It is highly recommended to back up any important data before proceeding with the reset.

## 1. Identify the Database File

The local database for the TEA Platform is stored in an SQLite file typically located at **`eap_backend/db.sqlite3`** within your project directory.

## 2. Delete the Database File

To reset your database, you need to delete the existing SQLite file. Navigate to the **`eap_backend`** directory and remove the **`db.sqlite3`** file.

```bash
$ rm eap_backend/db.sqlite3
```

## 3. Recreate the Database

After deleting the old database file, you'll need to recreate the database structure to continue working with a clean state.

Ensure your backend environment is correctly set up, then execute the following Django management commands:

```bash
$ python manage.py makemigrations
$ python manage.py migrate
```

These commands will generate a **new `db.sqlite3` file** with a fresh database schema based on your Django models.

## Running on Your Local Machine

For local deployments, the use of SQLite simplifies the process of resetting your database. After deleting the `db.sqlite3` file and running the migration commands, your backend will operate with a new, empty database.

This process effectively removes all existing data, allowing you to start anew with your development or testing activities on the TEA Platform.

<!--
# Resetting database on Local Deployments

1. **Identify the Database File**: By default, the database is an sqlite file located at `eap_backend/db.sqlite3`.

2. **Delete the Database File**: Simply delete the file eap_backend/db.sqlite3.

3. **Recreate the Database**:

    - Ensure you've set up the backend environment following these instructions.
    - Run the commands:

        ```bash
        $ python manage.py makemigrations
        $ python manage.py migrate
        ```

        This will establish a fresh sqlite file with an empty database.

## Running on your local machine

Unless you have changed some settings, you will likely be using a local `sqlite`
file for your database. To remove it, simply remove the file
`eap_backend/db.sqlite3`. Then run (having setup the environment for the backend
following the instructions [here](README.md)) the commands:

```
$ python manage.py makemigrations && python manage.py migrate
```

and next time you run the backend, you should have a new sqlite file with an
empty database.
-->

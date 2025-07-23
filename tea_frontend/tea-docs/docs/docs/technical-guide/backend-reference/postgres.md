---
sidebar_position: 3
sidebar_label: 'Postgres Database'
---

# Postgres

## Resetting the Database

Resetting the database of the Trustworthy and Ethical Assurance (TEA) Platform might become necessary under various circumstances. Whether you're cleaning up after a demonstration, addressing schema changes, or preparing for a new phase of development, understanding how to reset your database safely and effectively is crucial.

:::warning

    Resetting the database is a powerful action that can help maintain the cleanliness and integrity of your installation. However, it should be approached with caution to avoid accidental data loss.

:::

:::info "Reasons for Resetting"

    1. Post-Demo Cleanup: After demonstrating the TEA Platform, you might want to remove all test data, including users and cases, to ensure a clean slate for actual use.
    2. Schema Changes: Implementing changes in the database schema that cannot be migrated using Django's standard migration tools may require a fresh start.

:::

The process for resetting the TEA Platform database differs depending on the environment in which it is deployed:

### Local Deployment

For local deployments, the use of SQLite simplifies the process of resetting your database. After deleting the `db.sqlite3` file and running the migration commands, your backend will operate with a new, empty database.

This process effectively removes all existing data, allowing you to start anew with your development or testing activities on the TEA Platform.

!!! warning

    This process will remove all existing data in the database. It is highly recommended to back up any important data before proceeding with the reset.

#### 1. Identify the Database File

The local database for the TEA Platform is stored in an SQLite file typically located at **`eap_backend/db.sqlite3`** within your project directory.

#### 2. Delete the Database File

To reset your database, you need to delete the existing SQLite file. Navigate to the **`eap_backend`** directory and remove the **`db.sqlite3`** file.

```shell
rm eap_backend/db.sqlite3
```

#### 3. Recreate the Database

After deleting the old database file, you'll need to recreate the database structure to continue working with a clean state.

Ensure your backend environment is correctly set up, then execute the following Django management commands:

```shell
python manage.py makemigrations && \
python manage.py migrate
```
These commands will generate a **new `db.sqlite3` file** with a fresh database schema based on your Django models.

### Azure Deployment

Resetting your database on Azure involves a few crucial steps to ensure that the process is completed smoothly without hindering the accessibility of your TEA Platform. This guide will walk you through the necessary steps to reset your database deployed on Microsoft Azure.

!!! warning

    This process will remove all existing data in the database. It is highly recommended to back up any important data before proceeding with the reset.

!!! info "Prerequisities"

    The PostgreSQL command-line tool, `psql`, is required for directly interacting with your Azure database. Mac users with Homebrew can install it using `brew install postgresql`. Windows and Linux users should refer to their respective package managers or download it from the PostgreSQL official website.

#### 1. Allow IP Connection

Before proceeding with the reset, ensure your local machine's IP address is allowed to connect to the Azure database server.

- Navigate to the **Azure portal**.
- Locate your **database resource**.
- Under **"Connection security"** on the left sidebar, select **"Add current client IP address"** and save your changes.

#### 2. Reset the Database via psql

You will now drop the existing database and create a new one using `psql`.

Open your terminal or command prompt and execute the following commands:

```shell
psql --host=SERVER_NAME.postgres.database.azure.com --port=5432 --username=ADMIN_USERNAME@SERVER_NAME --dbname=postgres
```

Once connected, run:

```sql
postgres=> DROP DATABASE eap;
postgres=> CREATE DATABASE eap;
postgres=> \c eap;
postgres=> \q
```

Replace SERVER_NAME and ADMIN_USERNAME with the actual server name and admin username provided in the Azure portal. Ensure you have the admin password at hand, as it might be required during connection.

#### 3. Restart the Backend Web App

To apply the changes and ensure your application connects to the refreshed database, you need to restart your backend web application.

- Go back to the **Azure portal**.
- Find your **backend web app** service.
- Use the **"Restart"** option to reboot the application.

After a brief wait, your TEA Platform application should be operational with a clean database, ready for new data.

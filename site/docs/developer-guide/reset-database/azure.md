# Resetting the Database on Azure Deployments

Resetting your database on Azure involves a few crucial steps to ensure that the process is completed smoothly without hindering the accessibility of your TEA Platform. This guide will walk you through the necessary steps to reset your database deployed on Microsoft Azure.

!!! warning

    This process will remove all existing data in the database. It is highly recommended to back up any important data before proceeding with the reset.

## Prerequisites

The PostgreSQL command-line tool, `psql`, is required for directly interacting with your Azure database. Mac users with Homebrew can install it using `brew install postgresql`. Windows and Linux users should refer to their respective package managers or download it from the PostgreSQL official website.

## 1. Allow IP Connection

Before proceeding with the reset, ensure your local machine's IP address is allowed to connect to the Azure database server.

- Navigate to the **Azure portal**.
- Locate your **database resource**.
- Under **"Connection security"** on the left sidebar, select **"Add current client IP address"** and save your changes.

## 2. Reset the Database via psql

You will now drop the existing database and create a new one using `psql`.

Open your terminal or command prompt and execute the following commands:

```bash
$ psql --host=SERVER_NAME.postgres.database.azure.com --port=5432 --username=ADMIN_USERNAME@SERVER_NAME --dbname=postgres
```

Once connected, run:

```sql
postgres=> DROP DATABASE eap;
postgres=> CREATE DATABASE eap;
postgres=> \c eap;
postgres=> \q
```

Replace SERVER_NAME and ADMIN_USERNAME with the actual server name and admin username provided in the Azure portal. Ensure you have the admin password at hand, as it might be required during connection.

### 3. Restart the Backend Web App

To apply the changes and ensure your application connects to the refreshed database, you need to restart your backend web application.

- Go back to the **Azure portal**.
- Find your **backend web app** service.
- Use the **"Restart"** option to reboot the application.

After a brief wait, your TEA Platform application should be operational with a clean database, ready for new data.

<!--
# Resetting database on Azure Deployments

1. **Allow IP Connection**:

    - If you haven't permitted your IP address to connect to the Azure database server, head to the Azure portal.
    - Find your database resource, and under "Connection security" in the left sidebar, select "Add current client IP address". Save your changes.

2. **Install `psql`**:
    - For Mac users with Homebrew: brew install postgresql.
    - For other OS users, consider searching for appropriate installation methods.

3. **Reset the Database via `psql`**:
    - Run the commands:

        ```bash
        psql --host=SERVER_NAME.postgres.database.azure.com --port=5432 --username=ADMIN_USERNAME@SERVER_NAME --dbname=postgres
        postgres=> DROP DATABASE eap;
        postgres=> CREATE DATABASE eap;
        postgres=> \c eap;
        postgres=> \q
        ```

        Replace `SERVER_NAME` and `ADMIN_USERNAME` with the appropriate values from the Azure portal. The admin password might be located in a keyvault.

4. **Restart the Backend Web App**:

    - In the Azure portal, locate the backend web app.
    - Restart it, and after a short wait, your application should be operational with a refreshed database.


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
-->

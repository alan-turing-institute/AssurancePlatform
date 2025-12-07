---
sidebar_position: 3
sidebar_label: 'PostgreSQL Database'
---

# PostgreSQL Database

## Resetting the Database

Resetting the database of the Trustworthy and Ethical Assurance (TEA) Platform might become necessary under various circumstances. Whether you're cleaning up after a demonstration, addressing schema changes, or preparing for a new phase of development, understanding how to reset your database safely and effectively is crucial.

:::warning

Resetting the database is a powerful action that can help maintain the cleanliness and integrity of your installation. However, it should be approached with caution to avoid accidental data loss.

:::

:::info "Reasons for Resetting"

1. Post-Demo Cleanup: After demonstrating the TEA Platform, you might want to remove all test data, including users and cases, to ensure a clean slate for actual use.
2. Schema Changes: Implementing significant changes in the database schema may require a fresh start.

:::

The process for resetting the TEA Platform database differs depending on the environment in which it is deployed:

### Local Development (Docker)

For local development using Docker Compose, you can reset the database using Prisma commands:

#### 1. Stop the Development Environment

```shell
docker-compose -f docker-compose.development.yml down
```

#### 2. Remove the Database Volume (Optional - Full Reset)

To completely remove all data:

```shell
docker volume rm assuranceplatform_postgres_data
```

#### 3. Restart and Run Migrations

```shell
docker-compose -f docker-compose.development.yml up -d --build
docker exec tea_app_dev npx prisma migrate dev 
```

#### Alternative: Reset Without Removing Volume

If you want to reset the database without removing the Docker volume:

```shell
docker exec tea_app_dev npx prisma migrate reset 
```

:::warning

This command will drop all data and re-run all migrations. Use with caution.

:::

### Azure Deployment

Resetting your database on Azure involves a few crucial steps to ensure that the process is completed smoothly without hindering the accessibility of your TEA Platform.

:::warning

This process will remove all existing data in the database. It is highly recommended to back up any important data before proceeding with the reset.

:::

:::info "Prerequisites"

The PostgreSQL command-line tool, `psql`, is required for directly interacting with your Azure database. Mac users with Homebrew can install it using `brew install postgresql`. Windows and Linux users should refer to their respective package managers or download it from the PostgreSQL official website.

:::

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
postgres=> DROP DATABASE tea;
postgres=> CREATE DATABASE tea;
postgres=> \c tea;
postgres=> \q
```

Replace SERVER_NAME and ADMIN_USERNAME with the actual server name and admin username provided in the Azure portal.

#### 3. Run Prisma Migrations

After recreating the database, run Prisma migrations to set up the schema:

```shell
npx prisma migrate deploy 
```

#### 4. Restart the Web App

To apply the changes and ensure your application connects to the refreshed database, restart your web application service in the Azure portal.

After a brief wait, your TEA Platform application should be operational with a clean database, ready for new data.

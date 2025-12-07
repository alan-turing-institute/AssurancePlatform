---
sidebar_position: 3
sidebar_label: 'Cloud Deployment'
---

# Deploying the TEA Platform

## Microsoft Azure

Deploying the Trustworthy and Ethical Assurance (TEA) Platform on Microsoft Azure utilises Docker for containerisation, Azure Web Apps for hosting, and Azure Database for PostgreSQL for database services. This guide outlines the steps for setting up the TEA Platform on Azure, ensuring a robust and scalable deployment.

## Prerequisites

Before beginning the deployment process, please ensure you have the following:

- Basic understanding of cloud services, specifically Microsoft Azure, and familiarity with the Azure portal.
- Docker installed and configured on your machine.
- An active Microsoft Azure account as well as an active DockerHub account.
- Git installed for cloning the repository.
- PostgreSQL command-line tool (`psql`) for database setup.
- A GitHub account for OAuth setup.

Also, consider reviewing security best practices for managing secrets and passwords throughout the deployment process.

## Setting Up the PostgreSQL Database

### 1. Create a PostgreSQL Database

Navigate to the Azure Portal, select "+ Create a New Resource", choose "Azure Database for PostgreSQL", and click "Create". Opt for a "Flexible Server" setup.

### 2. Configuration

After selecting your Subscription, Resource Group, and Region, specify your "Server name", "Admin username", and "Password". Remember these details as they are crucial for subsequent steps.

### 3. Firewall Configuration

To allow connections to your database, configure a firewall rule under "Connection Security" by adding your client IP address. Ensure "Allow access to Azure services" is enabled.

### 4. Database Initialisation

Use psql to create your database:

```shell
psql --host=SERVER_NAME.postgres.database.azure.com --port=5432 --username=ADMIN_USERNAME --dbname=postgres
```

```sql
postgres=> CREATE DATABASE tea;
postgres=> \q
```

## Application Deployment

### 1. Build Docker Image

Build and push your Docker image:

```shell
docker build -t YOUR_DOCKER_USERNAME/tea-platform:latest -f Dockerfile .
docker push YOUR_DOCKER_USERNAME/tea-platform:latest
```

Note: You will need to [sign up for DockerHub](https://hub.docker.com/signup) and run `docker login` before pushing images.

### 2. Create Azure Web App

Create a new "Web App" in Azure Portal:

1. Select "Docker Container" and "Linux" for publishing
2. Choose your pricing tier
3. Configure the container settings to pull from your DockerHub image

### 3. Configure Environment Variables

In the Azure Web App settings, add the following environment variables:

```bash
# Database
DATABASE_URL=postgresql://ADMIN_USERNAME:PASSWORD@SERVER_NAME.postgres.database.azure.com:5432/tea?sslmode=require

# Authentication
NEXTAUTH_SECRET=your-generated-secret
NEXTAUTH_URL=https://YOUR_WEBAPP_NAME.azurewebsites.net

# GitHub OAuth
GITHUB_APP_CLIENT_ID=your-github-client-id
GITHUB_APP_CLIENT_SECRET=your-github-client-secret
```

### 4. Run Database Migrations

After the web app is deployed, run Prisma migrations:

```shell
# Connect to the web app's console or run via CI/CD
npx prisma migrate deploy 
```

## Final Steps

After configuring all settings, test the deployment by accessing your web app's URL. You should be able to interact with the TEA Platform without issues.

## Continuous Deployment

For automated deployments, consider setting up GitHub Actions to:

1. Build and test on push to main branch
2. Build and push Docker image to DockerHub
3. Trigger Azure Web App to pull the latest image

## Conclusion

Deploying the TEA Platform on Azure involves setting up a secure and scalable environment. By following these steps, you can ensure your deployment is robust and ready for production use. Always remember to secure your secret keys and sensitive information, especially when deploying in a public cloud environment.

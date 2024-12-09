---
sidebar_position: 3
sidebar_label: 'Cloud Deployment'
---

# Deploying the TEA Platform

## Microsoft Azure

Deploying the Trustworthy and Ethical Assurance (TEA) Platform on Microsoft Azure utilizes Docker for containerization, Azure Web Apps for hosting, and Azure Database for PostgreSQL for database services. This guide outlines the steps for setting up the TEA Platform on Azure, ensuring a robust and scalable deployment.

<!-- The following procedure makes use of Docker, Azure Webapps, and Azure Database for Postgresql. These instructions make use of the Azure Portal. A future version will focus on scripted deployment, using either the Azure CLI, the Azure Python SDK, or Terraform. -->

## Prerequisites

Before beginning the deployment process, please ensure you have the following:

- Basic understanding of cloud services, specifically Microsoft Azure, and familiarity with the Azure portal.
- Docker installed and configured on your machine.
- An active Microsoft Azure account as well as an active DockerHub account.
- Git installed for cloning the repository.
- PostgreSQL command-line tool (`psql`) for database setup.
- A GitHub account for OAuth and actions setup.
- (Optional) Anaconda or Miniconda for managing Python environments, offering an easier way to handle project dependencies.

Also, consider reviewing security best practices for managing secrets and passwords throughout the deployment process.

## Setting Up the PostgreSQL Database

1. **Create a PostgreSQL Database**

Navigate to the Azure Portal, select "+ Create a New Resource", choose "Azure Database for PostgreSQL", and click "Create". Opt for a "Single Server" setup.

2. **Configuration**

    After selecting your Subscription, Resource Group, and Region, specify your "Server name", "Admin username", and "Password". Remember these details as they are crucial for subsequent steps.

3. **Firewall Configuration**

    To allow connections to your database, configure a firewall rule under "Connection Security" by adding your client IP address. Ensure "Allow access to Azure services" is enabled and consider disabling "Enforce SSL connection" for local development.

4. **Database Initialization**

    Use psql to create your database:

    ```shell
    $ psql --host=SERVER_NAME.postgres.database.azure.com --port=5432 --username=ADMIN_USERNAME@SERVER_NAME --dbname=postgres
    $ postgres=> CREATE DATABASE eap;
    ```

## Backend Deployment

1. **Docker Image**

    If not using GitHub Actions for automated builds, manually build and push your Docker image for the backend:

    ```shell
    $ docker build -t YOUR_DOCKER_USERNAME/eap_backend:latest -f Dockerfile .
    $ docker push YOUR_DOCKER_USERNAME/eap_backend:latest
    ```

2. **Backend Web App**

    Create a new "Web App" in Azure Portal, selecting "Docker Container" and "Linux" for publishing. Configure the app with the environment variables related to your database and GitHub OAuth credentials.

## Frontend Deployment

1. **Frontend Docker Image**

    Similar to the backend, build and push your frontend Docker image, ensuring the `BASE_URL` is set to your backend's URL.

    ```shell
    $ docker build -t YOUR_DOCKER_USERNAME/eap_frontend:latest --build-arg BASE_URL="https://BACKEND_WEBAPP_NAME.azurewebsites.net/api" -f Dockerfile .
    $ docker push YOUR_DOCKER_USERNAME/eap_frontend:latest
    ```

    Note: In order to push to DockerHub, you will need to [sign-up for the service](https://hub.docker.com/signup) and run `docker login` before the above commands will work.

2. **Frontend Web App**

    Repeat the process for the backend web app, adjusting settings for the frontend, including `WEBSITES_PORT` and `REACT_APP_BASE_URL`.

## Cross-Origin Resource Sharing (CORS) Configuration

To enable seamless interaction between your frontend and backend, [set the `CORS_ORIGIN_WHITELIST` environment variable in your backend's settings](../backend/django-settings.md) to include your frontend's URL.

## Final Steps

After configuring CORS settings, test the deployment by accessing your frontend's URL. You should be able to interact with the TEA Platform without issues.

## Accessing the Django Admin Interface

The Django admin interface provides direct access to your database for managing data. Access it by navigating to https://BACKEND_WEBAPP_NAME.azurewebsites.net/admin and logging in with your superuser credentials. Use this interface cautiously, especially when deleting data.

## Conclusion

Deploying the TEA Platform on Azure involves setting up a secure and scalable environment. By following these steps, you can ensure your deployment is robust and ready for production use. Always remember to secure your secret keys and sensitive information, especially when deploying in a public cloud environment.
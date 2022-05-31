## Deploying the AssurancePlatform on Microsoft Azure Cloud using Docker, Azure Webapps, and Azure Database for Postgresql

These instructions make use of the Azure Portal.   A future version will focus on scripted deployment, using either the Azure CLI, the Azure Python SDK, or Terraform.

### Database

Instructions based on those [here.](https://docs.microsoft.com/en-us/azure/postgresql/quickstart-create-server-database-portal)

* In the [Azure portal](https://portal.azure.com) click "+ Create a New Resource", and select "Azure Database for PostgreSQL", and click "Create".  A "Single Server" should be sufficient.
* Select your Subscription, Resource Group (creating one if desired), and Region, and then choose a "Server name", "Admin username", and "Password".   Make sure you keep note of these!
* Configure a firewall rule to allow your local machine to connect to the database server: from the overview page of the Resource, click on "Connection Security" on the left sidebar, then click "+ Add current client IP address", and save.  Also ensure that "Allow access to Azure services" is set to "Yes".

* Use `psql` to connect to Postgres, and create the "eap" database.  There are instructions for installing psql on various OSs [here](https://www.timescale.com/blog/how-to-install-psql-on-mac-ubuntu-debian-windows/)
```
psql --host=SERVER_NAME.postgres.database.azure.com --port=5432 --username=ADMIN_USERNAME@SERVER_NAME --dbname=postgres
postgres=> CREATE DATABASE eap;
postgres=> \c eap;
postgres=> \q;
```

### Create backend docker image

This step can be skipped if you are using a github Action to build the Docker image, as is currently done for the `dev` and `main` branches.

* Install docker following instructions [here](https://docs.docker.com/engine/install/).
* Change to the `eap_backend/` directory.
```
docker build -t DOCKER_USERNAME/eap_backend:latest -f Dockerfile .
docker push DOCKER_USERNAME/eap_backend:latest
```
(in order to push to dockerhub, need to [sign-up](https://hub.docker.com/signup) and do `docker login`.)

### Create backend webapp

* In the [Azure portal](https://portal.azure.com) click "+ Create a New Resource", and select "Web App".
* Choose your subscription, resource group (suggest you use the same as for the database), and choose a "Name" (this will be part of the URL, needs to be unique amongst Azure webapps).  For "Publish", select "Docker Container" and "Linux".
* Set the region to be the same as for the database.
* Create a new App Service Plan if you don't already have one in the resource group, and for "Sku and size", I would suggest "B1".
* Proceed to the Docker tab, and set the container to the one you built and pushed in the previous step. Click "Apply" and "Review and create".
* Once the Webapp has been created, go to its summary page in the portal, and click on "Configuration" on the left sidebar, and add the following new settings (remember to save and restart the app once you're done):
    * WEBSITES_PORT=8000.
    * DBNAME=eap
    * DBHOST=NAME_OF_THE_DATABASE_YOU_JUST_CREATED.postgres.database.azure.com
    * DBUSER=NAME_OF_THE_DATABASE_USER_YOU_JUST_CREATED@NAME_OF_THE_DATABASE
    * DBPASSWORD=THE_PASSWORD_FOR_THE_USER_YOU_JUST_MADE
* Test that the backend is working (will take a few minutes to start up the first time) by going to https://BACKEND_WEBAPP_NAME.azurewebsites.net/api/cases and you should get an empty list.
* You may also want to turn on Continuous deployment from the Deployment Center settings, to have Azure pull the latest container every time one is available.

### Create frontend docker image

This step can be skipped if you are using a github Action to build the Docker image, as is currently (2022-04-25) dne for the `dev` and `main` branches.

* Change to the `frontend` directory.
* Build and push the docker image:
```
docker build -t DOCKER_USERNAME/eap_frontend:latest --build-arg BASE_URL="https://BACKEND_WEBAPP_NAME.azurewebsites.net/api" -f Dockerfile .
docker push DOCKER_USERNAME/eap_frontend:latest
```

### Create frontend webapp

Follow exactly the same process as for the backend webapp, but setting WEBSITES_PORT to 3000 and leaving out the DBNAME etc. variables.

### Nearly there...

At this stage, the only thing standing in our way is CORS (Cross-Origin Resource Sharing).
To fix this, go back to the Configuration panel of the backend server, where you previously set the port to be 8000, and create a new environment variable "CORS_ORIGIN_WHITELIST" with the value `http://localhost:3000,https://FRONTEND_WEBAPP_NAME.azurewebsites.net`. Remember to click save, and restart the backend.
Check the frontend web site to see that everything works.

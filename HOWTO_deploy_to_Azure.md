## Deploying the AssurancePlatform on Microsoft Azure Cloud using Docker, Azure Webapps, and Azure Database for Postgresql

These instructions make use of the Azure Portal.   A future version will focus on scripted deployment, using either the Azure CLI, the Azure Python SDK, or Terraform.

### Database

Instructions based on those [here.](https://docs.microsoft.com/en-us/azure/postgresql/quickstart-create-server-database-portal)

* In the [Azure portal](https://portal.azure.com) click "+ Create a New Resource", and select "Azure Database for PostgreSQL", and click "Create".  A "Single Server" should be sufficient.
* Select your Subscription, Resource Group (creating one if desired), and then choose a "Server name", "Admin username", and "Password".   Make sure you keep note of these!
* Configure a firewall rule to allow your local machine to connect to the database server: from the overview page of the Resource, click on "Connection Security" on the left sidebar, then click "+ Add current client IP address", and save.  Also ensure that "Allow access to Azure services" is set to "Yes".

* Use `psql` to connect to Postgres, and create the "eap" database.  There are instructions for installing psql on various OSs [here](https://www.timescale.com/blog/how-to-install-psql-on-mac-ubuntu-debian-windows/)
```
psql --host=SERVER_NAME.postgres.database.azure.com --port=5432 --username=ADMIN_USERNAME@SERVER_NAME --dbname=postgres
postgres=> CREATE DATABASE eap;
postgres=> \c eap;
postgres=> \q;
```

### Create backend docker image

* Install docker following instructions [here](https://docs.docker.com/engine/install/).
* Change to the `eap_backend/` directory, and copy `Dockerfile` to a new file `Dockerfile_with_secrets`.
* In this new `Dockerfile_with_secrets`, fill in the appropriate values for database variables
  -  `ENV DBHOST='SERVER_NAME.postgres.database.azure.com'`
  -  `ENV DBNAME='eap'`
  -  `ENV DBUSER='ADMIN_USERNAME@SERVER_NAME'`
  -  `ENV DBPASSWORD='PASSWORD'`
  -  (substituting in the SERVER_NAME, ADMIN_USERNAME, and PASSWORD that you entered when creating the PostgresSQL resource).
* Build and push the docker image:
```
docker build -t DOCKER_USERNAME/eap_backend:latest -f Dockerfile_with_secrets .
docker push DOCKER_USERNAME/eap_backend:latest
```
(in order to push to dockerhub, need to [sign-up](https://hub.docker.com/signup) and do `docker login`.)

### Create backend webapp

* In the [Azure portal](https://portal.azure.com) click "+ Create a New Resource", and select "Web App".
* Choose your subscription, resource group (suggest you use the same as for the database), and choose a "Name" (this will be part of the URL, needs to be unique amongst Azure webapps).  For "Publish", select "Docker Container" and "Linux".
* Create a new App Service Plan if you don't already have one in the resource group, and for "Sku and size", I would suggest "B1". Click "Apply" and "Review and create".
* Once the Webapp has been created, go to its summary page in the portal, and click on "Configuration" on the left sidebar.  Click "+ New Application Setting", and make a new setting with "Name" of "WEBSITES_PORT" and "VALUE" of 8000.  Save, and restart the webapp.
* Test that the backend is working (will take a few minutes to start up the first time) by going to https://BACKEND_WEBAPP_NAME.azurewebsites.net/api/cases and you should get an empty list.

### Create frontend docker image

* Change to the `frontend` directory.   Edit the file `src/config.json` and set `BASE_URL` to be "https://BACKEND_WEBAPP_NAME.azurewebsites.net/api".
* Build and push the docker image:
```
docker build -t DOCKER_USERNAME/eap_frontend:latest -f Dockerfile .
docker push DOCKER_USERNAME/eap_frontend:latest
```

### Create frontend webapp

Follow exactly the same process as for the backend webapp, but setting WEBSITES_PORT to 3000.

### Nearly there...

At this stage, the only thing standing in our way is CORS (Cross-Origin Resource Sharing) - the backend won't respond to requests from unrecognised sources.
To fix this, edit the file `eap_backend/eap_backend/settings.py` and in the "CORS_ORIGIN_WHITELIST", add `https://FRONTEND_WEBAPP_NAME.azurewebsites.net` to the list.
Now, rebuild the backend docker image following the instructions above, push to dockerhub, and restart the backend webapp.


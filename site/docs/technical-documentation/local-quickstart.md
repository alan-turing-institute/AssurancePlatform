# Quickstart (Local Install)

!!! info "Live Demo Version"

    For those looking to explore without installing, a live demo version of the assurance platform is available at https://assuranceplatform.azurewebsites.net/. Please be aware that data in the demo environment is periodically cleared.

Setting up a local installtion of the TEA Platform (e.g. for development) involves configuring both the backend and frontend components. It's important to set up the backend before proceeding with the frontend to ensure that the frontend can communicate with the backend services.

!!! note "Docker"

    A quicker way to get the TEA Platform running on your local machine is to use Docker. If you're familiar with Docker and docker-compose, you can follow the [Docker Quick Start guide](./docker-quickstart.md) to set up the platform with minimal effort.

First, clone the Assurance Platform repository to your local machine using the following command:

```shell
git clone https://github.com/alan-turing-institute/AssurancePlatform.git
cd
```

## Backend Installation

!!! warning "Prerequisites"

    Before you begin setting up the backend, it's essential to have a proper Python environment management system in place.

    There are many ways to do this, but for the purpose of this guide we will assume you are using Python's `venv` package.

### 1. Setting Up the Backend

Create and Activate a Virtual Environment

To avoid conflicts with other Python projects, create a virtual environment specifically for the TEA Platform backend. Using Conda, you can create a new environment with Python 3.8 as follows:

```shell
python -m venv .env
source .env/bin/activate
```

### 2. Install Dependencies

Navigate to the eap_backend directory within the cloned repository and install the required dependencies:

```shell
cd eap_backend
pip install -r requirements.txt
```

### 3. Initialize the Database

Use Django's built-in commands to set up the database. By default, this guide uses SQLite for simplicity and ease of use:

```shell
python manage.py migrate
```

### 4. Run Tests

Ensure everything is set up correctly by running the Django test suite:

```shell
python manage.py test
```

### 5. Launch the Backend Server

Start the Django development server. By default, the server will run on port 8000:

```shell
python manage.py runserver
```

At this point, your backend should be running locally, accessible via http://localhost:8000/api. You can now proceed to set up the frontend to interact with the backend API.

### 6. Running Locally: After Changes

After making any updates to the database schema or if you're running the server for the first time, ensure to apply migrations:

```shell
python manage.py migrate
```

### 7. Running the API Server

To start the API server, simply execute:

```shell
python manage.py runserver
```

from the `eap_backend` directory. The server will restart automatically upon code changes, making development efficient and streamlined.

### Optional: Running Tests

It's good practice to run tests frequently during development. To execute the test suite, use:

```shell
python manage.py test
```

## Frontend Installation

!!! warning "Prerequisites"

    Ensure you have [Node.js](https://nodejs.org/en/download) and npm installed on your system.
    Ensure you have installed the backend, as detailed in the previous steps.

### 1. Navigate to the frontend directory

```shell
# Assumes you are in the root directory
cd next-frontend
```

### 2. Install dependencies using npm

```shell
npm install
```

### 3. Run the application

To run the application in development mode, use the following command:

```shell
npm run dev
```

This command starts the development server and opens the application in your default web browser. The application will automatically reload if you make any changes to the source code.

To build and run the application in production mode, use the following command

```shell
npm run build
npm start
```

This will build the application for production and start a server to serve the built files.

### 4. Configuration

The application uses environment variables for configuration. Create a `.env.local` file in the root directory and specify the required environment variables. You can use the `.env.example` file as a template.

#### Environment Variables Example

```js
GITHUB_APP_CLIENT_ID={gh-clientid-value}
GITHUB_APP_CLIENT_SECRET={gh-secret-valie}
NEXTAUTH_SECRET={unique-string}
NEXT_PUBLIC_API_URL={api-url-value}
API_URL={api-url-value}
NEXTAUTH_URL={frontend-url-value}
```

To generate a unique string for the `NEXTAUTH_SECRET` you can run:

```bash
openssl rand -base64 32
```

### Optional" Troubleshooting SSL Errors

If you encounter any SSL errors during setup, try updating npm and forcing an audit fix, followed by updating react-scripts to the latest version.

```shell
npm update && \
npm audit fix --force && \
npm i react-scripts@latest
```

## Conclusion

By following these steps, you'll have the the TEA Platform running locally on your development machine, ready for further development and testing.

You should now be able to visit the platform at [http://localhost:3000](http://localhost:3000)

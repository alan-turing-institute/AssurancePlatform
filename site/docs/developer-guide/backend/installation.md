# Backend Installation and Setup Guide

Welcome to the setup guide for the backend environment of the Trustworthy and Ethical Assurance (TEA) Platform. This guide will walk you through the necessary steps to get the backend up and running on your local machine. Whether you're setting up for development, testing, or preparing for production deployment, this guide covers installing Python and Django, initializing the database with SQLite for development, and configuring PostgreSQL for more robust environments.

## Prerequisites

{%
   include-markdown "./_prerequisites.md"
   start="<!--prerequisites-start-->"
   end="<!--prerequisites-end-->"
%}

## Setting Up the Backend

1. **Clone the Repository**

    First, clone the Assurance Platform repository to your local machine using the following command:

    ```shell
    $ git clone https://github.com/alan-turing-institute/AssurancePlatform.git
    ```

    This command copies all the necessary files to your local system.

2. **Setting Up the Backend**

    Create and Activate a Virtual Environment

    To avoid conflicts with other Python projects, create a virtual environment specifically for the TEA Platform backend. Using Conda, you can create a new environment with Python 3.8 as follows:

    ```shell
    $ conda create --name eapenv python=3.8 -y
    $ conda activate eapenv
    ```

3. **Install Dependencies**

    Navigate to the eap_backend directory within the cloned repository and install the required dependencies:

    ```shell
    $ cd eap_backend
    $ pip install -r requirements.txt
    ```

4. **Initialize the Database**

    Use Django's built-in commands to set up the database. By default, this guide uses SQLite for simplicity and ease of use:

    ```shell
    $ python manage.py migrate
    ```

5. **Run Tests**

    Ensure everything is set up correctly by running the Django test suite:

    ```shell
    $ python manage.py test
    ```

6. **Launch the Backend Server**

    Start the Django development server. By default, the server will run on port 8000:

    ```shell
    $ python manage.py runserver
    ```

    At this point, your backend should be running locally, accessible via http://localhost:8000/api. You can now proceed to set up the frontend to interact with the backend API.

## Running Locally: After Changes

After making any updates to the database schema or if you're running the server for the first time, ensure to apply migrations:

```shell
python manage.py migrate
```

## Running the API Server

To start the API server, simply execute:

```shell
python manage.py runserver
```

from the `eap_backend` directory. The server will restart automatically upon code changes, making development efficient and streamlined.

## Running Tests

It's good practice to run tests frequently during development. To execute the test suite, use:

```shell
python manage.py test
```

## Continue with Frontend Setup

This guide provides you with the foundation needed to develop and test the TEA Platform's backend. With the backend operational, you can focus on integrating with the frontend or expanding the platform's capabilities. [>> Continue with frontend setup.](../frontend/installation.md)

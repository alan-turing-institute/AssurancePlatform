# Set Up Your Development Environment

Setting up your development environment for the Trustworthy and Ethical Assurance (TEA) Platform involves configuring both the backend and frontend components. This guide will walk you through the necessary steps to get your local development environment up and running. It's important to set up the backend before proceeding with the frontend to ensure that the frontend can communicate with the backend services.

!!! note

    A quicker way to get the TEA Platform running on your local machine is to use Docker. If you're familiar with Docker and docker-compose, you can follow the [Docker Quick Start guide](./docker-quickstart.md) to set up the platform with minimal effort.

## Prerequisites

Before starting the setup process, ensure you have the following prerequisites installed on your system:

### Backend Prerequisites

{%
   include-markdown "./backend/_prerequisites.md"
   start="<!--prerequisites-start-->"
   end="<!--prerequisites-end-->"
%}


### Frontend Prerequisites

{%
   include-markdown "./frontend/_prerequisites.md"
   start="<!--prerequisites-start-->"
   end="<!--prerequisites-end-->"
%}

## Backend Installation

The backend of the TEA Platform is built with the Django framework and provides the API endpoints necessary for the frontend application to function.

For detailed instructions on setting up the backend, including configuring the database and running the Django development server, refer to the [Backend Installation page](./backend/installation.md#setting-up-the-backend).

After setting up the backend, you can proceed with the frontend setup.

## Frontend Installation

The frontend application is developed using the React framework, enabling dynamic user interactions and a responsive design.

The frontend setup involves installing npm dependencies and running the development server. For step-by-step guidance, visit the [Frontend Installation page](./frontend/installation.md#setting-up-the-frontend).

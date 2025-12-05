---
sidebar_position: 2
sidebar_label: 'Docker Install'
---

# Docker Quickstart

This guide is designed for individuals who have a basic understanding of Docker and Docker Compose.

:::info[Live Demo Version]

    For those looking to explore without installing, a live demo version of the assurance platform is available at https://assuranceplatform.azurewebsites.net/. Please be aware that data in the demo environment is periodically cleared.

:::

This Docker-based installation offers a straightforward and efficient way to get the TEA Platform running on your local machine, providing a sandbox for development, testing, or demonstration purposes. Happy exploring!

:::note[Local Install]

    If you wish to install the TEA platform locally on your computer without using Docker, please see our [local install guide](local-quickstart.md).

:::

## Prerequisites

Before beginning, ensure you have Docker and docker-compose installed on your system. These tools are essential for creating, deploying, and managing containers. For installation instructions, visit the [official Docker documentation](https://docs.docker.com/).

## Step-by-step Guide

### Clone the Repository

Start by cloning the Assurance Platform repository from GitHub to your local machine. Open your terminal and run the following command:

```shell
$ git clone https://github.com/alan-turing-institute/AssurancePlatform.git
```

This command downloads the project files to your local system.

### Navigate to the Project Directory

After cloning, change your current directory to the AssurancePlatform folder:

```shell
$ cd AssurancePlatform/
```

### Deploy with Docker Compose

Use docker-compose to pull the necessary images and start the containers. Execute:

```shell
$ docker compose pull && docker compose up
```

This command fetches the latest Docker images for the TEA Platform and runs them. The process may take a few minutes the first time as it downloads the images and initializes the containers.

### Access the Platform

Once the containers are up and running, the TEA Platform is accessible via your web browser. Simply go to: http://localhost:3000

You should now see the TEA Platform's homepage, ready for exploration and use.

### Shutting Down

When you're done using the platform and wish to stop the Docker containers, open a new terminal window. Ensure you're in the AssurancePlatform directory, then execute:

```shell
$ docker compose down
```

This command stops and removes the containers set up by docker-compose, effectively shutting down the platform until you choose to run it again.

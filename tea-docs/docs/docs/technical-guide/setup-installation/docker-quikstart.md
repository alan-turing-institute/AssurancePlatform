---
sidebar_position: 2
sidebar_label: 'Docker Install'
---

# Docker Quickstart

This guide is designed for individuals who have a basic understanding of Docker and Docker Compose.

:::info[Live Demo Version]

For those looking to explore without installing, a live demo version of the assurance platform is available at https://assuranceplatform.azurewebsites.net/. Please be aware that data in the demo environment is periodically cleared.

:::

This Docker-based installation offers a straightforward and efficient way to get the TEA Platform running on your local machine, providing a sandbox for development, testing, or demonstration purposes.

:::note[Local Install]

If you wish to install the TEA platform locally on your computer without using Docker, please see our [local install guide](./local-quikstart.md).

:::

## Prerequisites

Before beginning, ensure you have Docker and Docker Compose installed on your system. These tools are essential for creating, deploying, and managing containers. For installation instructions, visit the [official Docker documentation](https://docs.docker.com/).

## Step-by-step Guide

### 1. Clone the Repository

Start by cloning the Assurance Platform repository from GitHub to your local machine:

```shell
git clone https://github.com/alan-turing-institute/AssurancePlatform.git
cd AssurancePlatform
```

### 2. Configure Environment Variables

Copy the example environment file and configure it:

```shell
cp .env.example .env.local
```

The default values should work for Docker development, but you may want to customise:
- `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- GitHub OAuth credentials (optional)

### 3. Deploy with Docker Compose

Start the development environment:

```shell
docker-compose -f docker-compose.development.yml up -d --build
```

This command builds the Docker images and starts the containers. The process may take a few minutes the first time as it downloads dependencies and initialises the database.

### 4. Access the Platform

Once the containers are running, the TEA Platform is accessible via your web browser at: [http://localhost:3000](http://localhost:3000)

You should now see the TEA Platform's homepage, ready for exploration and use.

## Common Commands

### View Logs

```shell
docker-compose -f docker-compose.development.yml logs -f
```

### Run Database Migrations

```shell
docker exec tea_app_dev npx prisma migrate dev --schema=prisma/schema.new.prisma
```

### Run Tests

```shell
docker exec tea_app_dev pnpm run test
```

### Restart Services

```shell
docker-compose -f docker-compose.development.yml restart
```

### Shutting Down

When you're done using the platform and wish to stop the Docker containers:

```shell
docker-compose -f docker-compose.development.yml down
```

This command stops and removes the containers, effectively shutting down the platform until you choose to run it again.

### Full Reset (Including Database)

To completely reset the environment including all data:

```shell
docker-compose -f docker-compose.development.yml down -v
docker-compose -f docker-compose.development.yml up -d --build
```

The `-v` flag removes the database volume, giving you a fresh start.

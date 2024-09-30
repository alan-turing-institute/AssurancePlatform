# Deployment

You can deploy using Docker without Gitub actions. For example to build a `Staging` image you can navigate to `./docker/staging/` and run the following command.

```bash
docker compose build
```

Example of docker compose file

```
services:
  app:
    image: tea-fronted-staging:latest
    build:
      context: ../..
      dockerfile: docker/staging/Dockerfile
      args:
        GITHUB_APP_CLIENT_ID: ${GITHUB_APP_CLIENT_ID}
        GITHUB_APP_CLIENT_SECRET: ${GITHUB_APP_CLIENT_SECRET}
        NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
        API_URL: ${API_URL}
        NEXTAUTH_URL: ${NEXTAUTH_URL}
    environment:
      GITHUB_APP_CLIENT_ID: ${GITHUB_APP_CLIENT_ID}
      GITHUB_APP_CLIENT_SECRET: ${GITHUB_APP_CLIENT_SECRET}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
      API_URL: ${API_URL}
      NEXTAUTH_URL: ${NEXTAUTH_URL}
    ports:
      - "3000:3000"
    env_file:
      - .env

```

This will build your image based on the values in the Docker compose file. To run your new image use

```bash
docker compose up
```

You can also do the same for `production` by navigating to `./docker/production`. Just unsure that your `Dockerfile` for each it correct.

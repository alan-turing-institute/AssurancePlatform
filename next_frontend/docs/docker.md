# Understanding Docker and Its Use in Deploying Web Applications to Azure Web App Service

## What is Docker?

Docker is an open-source platform that automates the deployment, scaling, and management of applications in lightweight containers. Containers are standardized units of software that package code and its dependencies together, ensuring that the application runs seamlessly in any environment, whether it's on a developer's machine or in the cloud.

### Key Benefits of Docker:
- **Portability**: Run your application consistently across different environments.
- **Isolation**: Keep applications isolated from each other, avoiding conflicts between dependencies.
- **Scalability**: Easily scale applications by deploying multiple container instances.

## How Docker Works

Docker uses a client-server architecture:
- **Docker Client**: The command-line interface to communicate with the Docker daemon.
- **Docker Daemon**: Responsible for managing Docker containers, images, networks, and volumes.

### Dockerfile

A `Dockerfile` is a script containing a series of instructions on how to build a Docker image. It defines the environment and dependencies required for your application.

## Example Dockerfile Explained

Here’s a reference Dockerfile for a Node.js web application:

```dockerfile
# syntax=docker/dockerfile:1.4
FROM node:18-alpine AS base

# Declare build arguments
ARG GITHUB_APP_CLIENT_ID
ARG GITHUB_APP_CLIENT_SECRET
ARG NEXTAUTH_SECRET
ARG NEXT_PUBLIC_API_URL
ARG API_URL
ARG NEXTAUTH_URL

# 1. Install dependencies only when needed
FROM base AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY --link package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i; \
  else echo "Lockfile not found." && exit 1; \
  fi

# 2. Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

COPY --from=deps --link /app/node_modules ./node_modules
COPY --link . .

# Expose the build arguments as environment variables for the build process
ENV GITHUB_APP_CLIENT_ID=${GITHUB_APP_CLIENT_ID}
ENV GITHUB_APP_CLIENT_SECRET=${GITHUB_APP_CLIENT_SECRET}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV API_URL=${API_URL}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}

RUN yarn build

# 3. Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

RUN \
  addgroup -g 1001 -S nodejs; \
  adduser -S nextjs -u 1001

COPY --from=builder --link /app/public ./public
COPY --from=builder --link --chown=1001:1001 /app/.next/standalone ./
COPY --from=builder --link --chown=1001:1001 /app/.next/static ./.next/static

# Ensure the environment variables are available at runtime
ENV GITHUB_APP_CLIENT_ID=${GITHUB_APP_CLIENT_ID}
ENV GITHUB_APP_CLIENT_SECRET=${GITHUB_APP_CLIENT_SECRET}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV API_URL=${API_URL}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}

USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
```

### Dockerfile Breakdown
- **Base Image:** The image starts from a lightweight Node.js base image (node:18-alpine).
- **Build Arguments:** The ARG directives declare build-time variables, which can be passed when building the image.
- **Dependency Installation:**
  - A separate stage (deps) installs dependencies, optimizing the build process by reusing cached layers.
- **Build Stage:** The application is built in the builder stage, copying necessary files and running the build command.
- **Production Image:** The final image (runner) is created for production, minimizing size by only including necessary files.
- **Environment Variables:** Runtime environment variables are set to make them available to the application.
- **User and Port Configuration:** The application runs as a non-root user for security, and it exposes port 3000.
- **Startup Command:** The CMD instruction defines how to start the application.

## Deploying to Azure Web App Service

### Steps to Deploy (Manually)

1. **Create a Docker Image:**
- Build the Docker image using the command:

```bash
docker build --build-arg GITHUB_APP_CLIENT_ID=<your_client_id> \
             --build-arg GITHUB_APP_CLIENT_SECRET=<your_client_secret> \
             --build-arg NEXTAUTH_SECRET=<your_secret> \
             --build-arg NEXT_PUBLIC_API_URL=<your_api_url> \
             --build-arg API_URL=<your_api_url> \
             --build-arg NEXTAUTH_URL=<your_auth_url> \
             -t your-app-name .
```
2. **Push to a Container Registry:**
- Push the built image to a container registry like Azure Container Registry or Docker Hub.

3. **Create an Azure Web App:**
- Use the Azure portal or Azure CLI to create a new Web App, selecting "Docker" as the publishing option.

4. **Configure Container Settings:**
- Point your Azure Web App to the Docker image in your registry and set up any necessary environment variables.

5. **Deploy and Test:**
- Deploy the Web App and ensure that the application runs correctly in the Azure environment.

### Steps to Deploy (GithHub Actions)

In this roject we have CI/CD configured, with Github Actions. This allows us to merge changes into the `Develop` branch, and the Docker image will be built and pushed up into Docker Hub (with our credentials) and taing any `ENV` values form GitHub Secrets. 

#### Example

```yaml
- name: "Build develop"
        if: ${{ github.ref == 'refs/heads/develop' }}
        working-directory: next_frontend
        run: |
          docker build \
            --build-arg GITHUB_APP_CLIENT_ID=${{ secrets.value }} \
            --build-arg GITHUB_APP_CLIENT_SECRET=${{ secrets.value}} \
            --build-arg NEXTAUTH_SECRET=${{ secrets.value }} \
            --build-arg NEXT_PUBLIC_API_URL=${{ secrets.value }} \
            --build-arg API_URL=${{ secrets.value }} \
            --build-arg NEXTAUTH_URL=${{ secrets.value }} \
            -t turingassuranceplatform/eap_frontend:develop \
            -t turingassuranceplatform/eap_frontend:${{ env.commit_date }}.${{ env.sha_short }}\
            -f docker/staging/Dockerfile .
          docker push turingassuranceplatform/eap_frontend --all-tags

```

## Conclusion
Docker simplifies the deployment process of web applications by packaging everything needed to run into a container. When deploying to Azure Web App Service, it provides a consistent environment that enhances portability, scalability, and reliability.
# Trustworthy & Ethical Assurance Platform

TEA (Trustworthy & Ethical Assurance) Platform is a full-stack web application for creating and sharing structured assurance cases. Built with Next.js, React, TypeScript, and Prisma ORM.

## Getting Started

**Demo:** [Create Assurance Case with Goals, Claims and Strategies](https://scribehow.com/shared/Create_Assurance_Case_with_Goals_Claims_and_Strategies__vODBFxX_S3WTmdL8Zzd6Nw?referrer=workspace)

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Node.js](https://nodejs.org/) (v20+) and [pnpm](https://pnpm.io/) (for local development without Docker)

### Quick Start (Docker)

1. Clone the repository:

   ```bash
   git clone https://github.com/alan-turing-institute/AssurancePlatform.git
   cd AssurancePlatform
   ```

2. Copy the environment file and configure:

   ```bash
   cp .env.example .env.local
   ```

3. Start the development environment:

   ```bash
   docker-compose -f docker-compose.development.yml up -d --build
   ```

4. Access the application at [http://localhost:3000](http://localhost:3000)

### Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Database
DATABASE_URL="postgresql://tea_user:tea_password@postgres:5432/tea_dev"

# Authentication
NEXTAUTH_SECRET="your-secret-key"  # Generate with: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"

# GitHub OAuth (optional)
GITHUB_APP_CLIENT_ID="your-github-client-id"
GITHUB_APP_CLIENT_SECRET="your-github-client-secret"
```

### Development Commands

```bash
# Start all services
docker-compose -f docker-compose.development.yml up -d

# View logs
docker-compose -f docker-compose.development.yml logs -f

# Stop all services
docker-compose -f docker-compose.development.yml down

# Run database migrations
docker exec tea_app_dev npx prisma migrate dev 

# Run tests
docker exec tea_app_dev pnpm run test
```

### Local Development (without Docker)

If you prefer to run without Docker:

```bash
# Install dependencies
pnpm install

# Generate Prisma client
npx prisma generate 

# Run development server
pnpm run dev
```

Note: You'll need a PostgreSQL database running locally and update `DATABASE_URL` accordingly.

### Production

For production deployment, use the production Docker Compose configuration:

```bash
docker-compose up -d --build
```

## Documentation

Full documentation is available in the `tea-docs/` directory. To run the documentation site locally:

```bash
cd tea-docs
pnpm install
pnpm start
```

## Contributing

Contributions are welcome! If you find any issues or have suggestions for improvements, feel free to open an issue or submit a pull request.

## Licence

This project is licensed under the MIT Licence. See the LICENCE file for details.

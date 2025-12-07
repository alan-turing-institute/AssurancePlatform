---
sidebar_position: 1
sidebar_label: 'Local Install'
---

# Quickstart (Local Install)

:::info[Live Demo Version]

For those looking to explore without installing, a live demo version of the assurance platform is available at https://assuranceplatform.azurewebsites.net/. Please be aware that data in the demo environment is periodically cleared.

:::

Setting up a local installation of the TEA Platform (e.g. for development) involves configuring the application and its database. The recommended approach is to use Docker, but you can also run locally without Docker if preferred.

:::note[Docker (Recommended)]

A quicker way to get the TEA Platform running on your local machine is to use Docker. If you're familiar with Docker and docker-compose, you can follow the [Docker Quick Start guide](./docker-quikstart.md) to set up the platform with minimal effort.

:::

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v20 or later)
- [pnpm](https://pnpm.io/) package manager
- [PostgreSQL](https://www.postgresql.org/) (v14 or later)

## Step-by-Step Installation

### 1. Clone the Repository

```shell
git clone https://github.com/alan-turing-institute/AssurancePlatform.git
cd AssurancePlatform
```

### 2. Install Dependencies

```shell
pnpm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```shell
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```bash
# Database connection
DATABASE_URL="postgresql://username:password@localhost:5432/tea_dev"

# Authentication
NEXTAUTH_SECRET="your-secret-key"  # Generate with: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"

# GitHub OAuth (optional)
GITHUB_APP_CLIENT_ID="your-github-client-id"
GITHUB_APP_CLIENT_SECRET="your-github-client-secret"
```

To generate a unique string for the `NEXTAUTH_SECRET` you can run:

```bash
openssl rand -base64 32
```

### 4. Set Up the Database

Create a PostgreSQL database:

```shell
createdb tea_dev
```

Generate the Prisma client and run migrations:

```shell
npx prisma generate 
npx prisma migrate dev 
```

### 5. Run the Development Server

```shell
pnpm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Development Commands

### Running Tests

```shell
pnpm run test           # Run all tests
pnpm run test:watch     # Run tests in watch mode
pnpm run test:coverage  # Run tests with coverage report
```

### Database Management

```shell
# Generate Prisma client after schema changes
npx prisma generate 

# Create a new migration
npx prisma migrate dev 

# Reset database (drops all data)
npx prisma migrate reset 

# Open Prisma Studio (database GUI)
npx prisma studio 
```

### Code Quality

```shell
# Lint and format code
pnpm exec ultracite fix

# Check for issues without fixing
pnpm exec ultracite check

# Type check
npx tsc --noEmit
```

### Building for Production

```shell
pnpm run build
pnpm start
```

## Troubleshooting

### Database Connection Issues

If you encounter database connection errors:

1. Ensure PostgreSQL is running
2. Verify your `DATABASE_URL` in `.env.local`
3. Check that the database exists: `psql -l | grep tea_dev`

### Node.js Version Issues

The TEA Platform requires Node.js v20 or later. Check your version with:

```shell
node --version
```

If you need to manage multiple Node.js versions, consider using [nvm](https://github.com/nvm-sh/nvm).

## Conclusion

By following these steps, you'll have the TEA Platform running locally on your development machine, ready for further development and testing.

You should now be able to visit the platform at [http://localhost:3000](http://localhost:3000)

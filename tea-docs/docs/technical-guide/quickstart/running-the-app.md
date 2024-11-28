---
sidebar_position: 1
---

Running the app locally
==================

TEA (Trustworthy & Ethical Assurance) Platform is a web application developed using Next.js, React, and TypeScript. It provides a platform for managing and monitoring assurance cases in various domains.

Getting Started
---------------

Demo: [Create Assurance Case with Goals, Claims and Strategies](https://scribehow.com/shared/Create_Assurance_Case_with_Goals_Claims_and_Strategies__vODBFxX_S3WTmdL8Zzd6Nw?referrer=workspace)

To get started with Assurance Platform, follow these steps:

### Prerequisites

-   Node.js and npm (or Yarn) installed on your machine.
-   Have the API backend running locally

### Installation

1.  Clone the repository:

    ```
    git clone https://github.com/alan-turing-institute/AssurancePlatform.git
    ```

2.  Navigate to the project directory:

    ```
    cd next-frontend
    ```

3.  Install dependencies using npm:

    ```
    npm install
    ```

### Development

To run the application in development mode, navigate to this directory and use the following command.

```
npm run dev
```

This command starts the development server and opens the application in your default web browser. The application will automatically reload if you make any changes to the source code.

### Production

To build and run the application in production mode, use the following command

```
npm run build
npm start
```

This will build the application for production and start a server to serve the built files.

### Configuration

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

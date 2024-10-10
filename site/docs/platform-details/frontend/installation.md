# Frontend Setup and Development Guide

Setting up and running the frontend of the Trustworthy and Ethical Assurance (TEA) Platform is straightforward with Node.js and npm (Node Package Manager). This guide will walk you through installing the necessary tools, running the development server, and executing tests to ensure everything is set up correctly.

## Prerequisites

{%
   include-markdown "./_prerequisites.md"
   start="<!--prerequisites-start-->"
   end="<!--prerequisites-end-->"
%}

**Backend Setup**: Before starting with the frontend, make sure the backend server is up and running as the frontend will need to communicate with it.

## Setting Up the Frontend

1. **Clone the Repository**
    Start by cloning the TEA Platform repository to your local machine, if you haven't already done so.

    ```shell
    git clone https://github.com/alan-turing-institute/AssurancePlatform.git
    ```

2. **Navigate to the Frontend Directory**
    Change into the frontend directory within the cloned repository.

    ```shell
    cd next-frontend
    ```

3. **Install Dependencies**

    Run the following command to install all required npm packages specified in the package.json file.

    ```shell
    npm install
    ```

4. **Run the Development Server**

    Start the development server to launch the TEA Platform in your default web browser.

    ```shell
    npm run start
    ```

    or, for development server:

    ```shell
    npm run dev
    ```

    **This command will automatically open a new browser tab pointing to http://localhost:3000, where you can start interacting with the frontend application.**

5. **Run Tests**

    It's good practice to run the available tests to ensure that the frontend components are functioning as expected.

    ```shell
    npm run test
    ```

## Environment Variables

Ensure that you have added the following to your `.env.local` file in the root of this project.

```
NEXT_PUBLIC_STORAGESASTOKEN={token-value}
NEXT_PUBLIC_STORAGESOURCENAME={storage-name-value}

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

<!-- ## Additional Setup for SVG Export

To enable the export of SVG images from the frontend, you need to install the Mermaid CLI globally on your system.

```shell
$ npm install -g @mermaid-js/mermaid-cli
``` -->

## Troubleshooting SSL Errors

If you encounter any SSL errors during setup, try updating npm and forcing an audit fix, followed by updating react-scripts to the latest version.

```shell
$ npm update
$ npm audit fix --force
$ npm i react-scripts@latest
```

## Conclusion

By following these steps, you'll have the frontend of the TEA Platform running locally on your development machine, ready for further development and testing.

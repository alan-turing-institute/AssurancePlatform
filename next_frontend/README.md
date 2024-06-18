Assurance Platform
==================

Assurance Platform is a web application developed using Next.js, React, and TypeScript. It provides a platform for managing and monitoring assurance cases in various domains.

Getting Started
---------------

To get started with Assurance Platform, follow these steps:

### Prerequisites

-   Node.js and npm (or Yarn) installed on your machine.

### Installation

1.  Clone the repository:

    ```
    git clone https://github.com/alan-turing-institute/AssurancePlatform.git
    ```

2.  Navigate to the project directory:

    ```
    cd AssurancePlatform
    ```

3.  Install dependencies using npm:

    ```
    npm install
    ```

### Environment Variables

Ensure that you have added the following to your `.env.local` file in the root of this project.

```
NEXT_PUBLIC_API_URL=http://localhost:8000
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

### Deployment

You can deploy using Docker. Please follow these commands to build your docker image with docker compose.

```
docker compose build
```

To run your new image use

```
docker compose up
```

Demo
------------

[Create Assurance Case with Goals, Claims and Strategies](https://scribehow.com/shared/Create_Assurance_Case_with_Goals_Claims_and_Strategies__vODBFxX_S3WTmdL8Zzd6Nw?referrer=workspace)

Contributing
------------

Contributions are welcome! If you find any issues or have suggestions for improvements, feel free to open an issue or submit a pull request.

License
-------

This project is licensed under the MIT License. See the LICENSE file for details.

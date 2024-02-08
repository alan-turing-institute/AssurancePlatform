# TEA Platform API

Welcome to the Trustworthy and Ethical Assurance (TEA) Platform API documentation. This guide is designed to provide you with all the information you need to start integrating with and utilizing the TEA Platform's comprehensive set of features. Our API enables developers, researchers, and technology governance practitioners to access and manipulate assurance cases, user groups, comments, and more, facilitating a collaborative environment for ethical technology development.

## Quickstart

To get you started with the TEA Platform API, we'll walk you through a few basic `curl` commands to perform common actions such as user authentication, listing resources, and adding new entries.

### Authenticate a User

To interact with the TEA Platform API, you'll first need to authenticate. If you're logging in, you'll typically post your credentials to receive an authentication token.

```bash
$ curl -X POST http://localhost:8000/auth/login/ \
     -H 'Content-Type: application/json' \
     -d '{"username": "yourusername", "password": "yourpassword"}'
```

### List Cases

You can list assurance cases available to you.

```bash
$ curl -X GET http://localhost:8000/api/cases/
```

### Add a New Case

To create a new assurance case, you'll need to POST the required data.

```bash
$ curl -X POST http://localhost:8000/api/cases/ \
     -H 'Authorization: Bearer your_token_here' \
     -H 'Content-Type: application/json' \
     -d '{"name": "New Assurance Case", "description": "Detailed description of the case", "user_id": "1", "lock_uuid": "", "color_profile": "default"}'
```

These commands are just the beginning of what you can do with the TEA Platform API. Throughout this documentation, you'll find detailed descriptions of every endpoint available, including required parameters, request and response formats, and example requests to help you effectively utilize the platform.

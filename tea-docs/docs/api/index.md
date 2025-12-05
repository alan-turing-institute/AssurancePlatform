---
sidebar_position: 1
sidebar_label: 'TEA Platform API'
slug: /api
---


# TEA Platform API

Welcome to the Trustworthy and Ethical Assurance (TEA) Platform API documentation. This guide is designed to provide you with all the information you need to start integrating with and utilising the TEA Platform's comprehensive set of features. Our API enables developers, researchers, and technology governance practitioners to access and manipulate assurance cases, user groups, comments, and more, facilitating a collaborative environment for ethical technology development.

## Quickstart

To get you started with the TEA Platform API, we'll walk you through a few basic `curl` commands to perform common actions such as user authentication and listing resources.

### Authentication

The TEA Platform uses NextAuth.js for authentication. API routes are protected and require a valid session. For programmatic access, you'll typically:

1. Authenticate via the web interface
2. Use session cookies for subsequent API requests

### List Cases

You can list assurance cases available to you:

```bash
curl -X GET http://localhost:3000/api/cases/ \
     -H 'Cookie: next-auth.session-token=YOUR_SESSION_TOKEN'
```

### Get a Specific Case

To retrieve a specific assurance case by ID:

```bash
curl -X GET http://localhost:3000/api/cases/123 \
     -H 'Cookie: next-auth.session-token=YOUR_SESSION_TOKEN'
```

### Create a New Case

To create a new assurance case:

```bash
curl -X POST http://localhost:3000/api/cases/ \
     -H 'Cookie: next-auth.session-token=YOUR_SESSION_TOKEN' \
     -H 'Content-Type: application/json' \
     -d '{"name": "New Assurance Case", "description": "Detailed description of the case"}'
```

## API Endpoints

The TEA Platform exposes the following main API routes:

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/cases` | GET, POST | List and create assurance cases |
| `/api/cases/[id]` | GET, PUT, DELETE | Manage individual cases |
| `/api/cases/[id]/elements` | GET, POST | Manage case elements |
| `/api/elements/[id]` | GET, PUT, DELETE | Manage individual elements |
| `/api/teams` | GET, POST | List and create teams |
| `/api/teams/[id]` | GET, PUT, DELETE | Manage individual teams |

These commands are just the beginning of what you can do with the TEA Platform API. Throughout this documentation, you'll find detailed descriptions of every endpoint available, including required parameters, request and response formats, and example requests to help you effectively utilise the platform.

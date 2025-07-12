---
sidebar_position: 3
sidebar_label: 'GitHub Repository'
---

# GitHub Repository Endpoints

The TEA Platform integrates with GitHub to enable users to link their GitHub repositories directly to their profiles and assurance cases. This functionality fosters a seamless workflow for users who manage their assurance cases via GitHub repositories.

Below are the API endpoints available for interacting with GitHub repositories within the TEA Platform.

Replace `<int:pk>` with the actual user ID you're querying, `<user_id>` with the ID of the user to whom the repository should be linked, and `your_access_token_here` with your valid authentication token received after logging in.

The `curl` examples below provide a practical way for platform users to manage their GitHub repositories through the TEA Platform API, enhancing the integration between their assurance case work and codebase management.

## List All GitHub Repositories for a Specific User

Retrieve a list of all GitHub repositories associated with a specific user by their user ID. This endpoint is useful for understanding the scope of projects a user is involved in.

### Request

```bash
$ curl -X GET http://localhost:8000/api/users//<int:pk>/github_repositories/ \
     -H "Authorization: Token your_access_token_here"
```

### Response

A JSON array of GitHub repositories linked to the user, each including repository details such as name, URL, and description.

## List All GitHub Repositories

To view all GitHub repositories linked within the TEA Platform, irrespective of the user, use this endpoint. It provides a broad overview of all repositories integrated into the platform.

### Request

```bash
$ curl -X GET http://localhost:8000/api/github_repositories/ \
     -H "Authorization: Token your_access_token_here"
```

### Response

A JSON array containing every GitHub repository registered on the TEA Platform, with details like name, URL, and description for each repository.

## Add a New GitHub Repository

Link a new GitHub repository to the TEA Platform by providing the repository's details. This allows you to directly associate your GitHub projects with assurance cases or your user profile on the TEA Platform.

### Request

```bash
$ curl -X POST http://localhost:8000/api/github_repositories/ \
     -H "Content-Type: application/json" \
     -H "Authorization: Token your_access_token_here" \
     -d '{
           "name": "Repository Name",
           "url": "https://github.com/username/repository",
           "description": "Repository Description",
           "owner": <user_id>
         }'
```

### Response

JSON object of the newly added GitHub repository, confirming its successful registration on the platform.

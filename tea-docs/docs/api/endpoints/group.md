---
sidebar_position: 5
sidebar_label: 'Groups'
---

# Group Endpoints

Groups within the TEA Platform facilitate collaboration among users, allowing them to work together on assurance cases and share insights. Below are the API endpoints that manage group operations, including listing, creating, updating, and deleting groups.

Ensure to replace `<int:pk>` with the actual ID of the group you wish to interact with and `your_access_token_here` with your valid authentication token.

These `curl` commands here offer a direct way to manage group functionalities on the TEA Platform, enhancing its utility as a collaborative tool for ethical assurance in technology projects.

## List All Groups

Retrieve a comprehensive list of all groups on the TEA Platform. This is useful for discovering existing collaboration opportunities.

### Request

```bash
$ curl -X GET http://localhost:8000/api/groups/ \
     -H "Authorization: Token your_access_token_here"
```

### Response

A JSON array of groups, each with its details such as name, creation date, owner, and members.

## Create a New Group

Establish a new group on the platform by specifying its name. This endpoint can foster new collaboration channels for assurance case development.

### Request

```bash
$ curl -X POST http://localhost:8000/api/groups/ \
     -H "Content-Type: application/json" \
     -H "Authorization: Token your_access_token_here" \
     -d '{"name": "New Group Name"}'
```

### Response

JSON object of the created group, including its ID, name, and other pertinent details.

## Retrieve Details of a Specific Group

Access detailed information about a specific group by its ID. This endpoint provides insight into the group's composition and projects.

### Request

```bash
$ curl -X GET http://localhost:8000/api/groups/<int:pk>/ \
     -H "Authorization: Token your_access_token_here"
```

### Response

A JSON object detailing the requested group, including its name, members, and associated assurance cases.

## Update a Group's Details

Modify the details of an existing group, such as its name or members. This endpoint supports the dynamic nature of collaborative work.

### Request

```bash
$ curl -X PUT http://localhost:8000/api/groups/<int:pk>/ \
     -H "Content-Type: application/json" \
     -H "Authorization: Token your_access_token_here" \
     -d '{"name": "Updated Group Name"}'
```

### Response

JSON representation of the group after the update, reflecting the changes made.

## Delete a Group

Remove a group from the platform. This action should be used with caution, as it will dissolve the collaboration space.

### Request

```bash
$ curl -X DELETE http://localhost:8000/api/groups/<int:pk>/ \
     -H "Authorization: Token your_access_token_here"
```

### Response

HTTP 204 No Content on successful deletion, indicating that the group has been permanently removed.

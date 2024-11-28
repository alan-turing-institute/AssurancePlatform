# Comment Endpoints

The TEA Platform provides a set of endpoints dedicated to managing comments within assurance cases. This functionality allows users to engage in discussions, provide feedback, and collaborate on assurance case development.

Remember to replace `<int:assurance_case_id>` with the ID of the assurance case you're referring to, `<int:pk>` with the specific comment's ID, and `your_access_token_here` with your actual access token received upon authentication.

The `curl` examples offer here show a straightforward way to interact with the TEA Platform's comment functionalities directly from the command line.

## List All Comments for a Specific Assurance Case

Retrieve a list of all comments associated with a specific assurance case by making a GET request to the `/comments/<int:assurance_case_id>/` endpoint.

### Request

```bash
$ curl -X GET http://localhost:8000/api/comments/<int:assurance_case_id>/ \
     -H "Authorization: Token your_access_token_here"
```

### Response

A JSON array of comments related to the specified assurance case, each including details like the comment ID, content, author, and timestamps.

## Add a New Comment to an Assurance Case

To add a new comment to an assurance case, use the POST method with the assurance case ID in the URL.

### Request

```bash
$ curl -X POST http://localhost:8000/api/comments/<int:assurance_case_id>/ \
     -H "Content-Type: application/json" \
     -H "Authorization: Token your_access_token_here" \
     -d '{"content": "Your insightful comment here."}'
```

### Response

JSON object of the newly created comment, including its ID and content.

## Retrieve Details of a Specific Comment

Access the details of a specific comment by its ID using a GET request.

### Request

```bash
$ curl -X GET http://localhost:8000/api/comments/<int:pk>/ \
     -H "Authorization: Token your_access_token_here"
```

### Response

A JSON object detailing the requested comment, including its content, author, and related assurance case.

## Update a Comment

Update the content of an existing comment by sending a PUT request to the comment's specific endpoint.

### Request

```bash
$ curl -X PUT http://localhost:8000/api/comments/<int:pk>/ \
     -H "Content-Type: application/json" \
     -H "Authorization: Token your_access_token_here" \
     -d '{"content": "Updated content of the comment."}'
```

### Response

JSON representation of the updated comment, reflecting the new content.

## Delete a Comment

To remove a comment from an assurance case, issue a DELETE request to the specific comment's endpoint.

### Request

```bash
$ curl -X DELETE http://localhost:8000/api/comments/<int:pk>/ \
     -H "Authorization: Token your_access_token_here"
```

### Response

HTTP 204 No Content on successful deletion, indicating that the comment has been removed.

# User Endpoints

Managing user information is a critical aspect of the TEA Platform, facilitating user interaction, collaboration, and personalization. The user endpoints allow for retrieving personal details, listing all users, and managing user accounts, including creating, updating, and deleting users.

Replace `<int:pk>` with the actual ID of the user you are referencing, and `your_access_token_here` with the actual token you received upon authentication.

These `curl` examples provide straightforward methods to interact with the user-related functionalities of the TEA Platform, facilitating efficient user management and personalization.

## User Detail

Retrieve Details of the Currently Authenticated User
To view your own user details, including your username, email, and associated groups or assurance cases.

#### Request

```bash
$ curl -X GET http://localhost:8000/api/user/ \
     -H "Authorization: Token your_access_token_here"
```

#### Response

A JSON object containing your user details.

## User List & Management

### List All Users

Retrieve a list of all users on the TEA Platform, useful for finding collaborators or understanding the platform's user base.

#### Request

```bash
$ curl -X GET http://localhost:8000/api/users/ \
     -H "Authorization: Token your_access_token_here"
```

#### Response

A JSON array of users, each with their details.

### Create a New User

Add a new user to the TEA Platform by providing necessary information such as username and email.

#### Request

```bash
$ curl -X POST http://localhost:8000/api/users/ \
     -H "Content-Type: application/json" \
     -d '{"username": "new_user", "email": "new_user@example.com", "password": "secure_password"}'
```

#### Response

JSON object of the newly created user account.

### Retrieve a Specific User's Details

Access detailed information about a specific user by their user ID.

#### Request

```bash
$ curl -X GET http://localhost:8000/api/users//<int:pk>/ \
     -H "Authorization: Token your_access_token_here"
```

#### Response

A JSON object detailing the specified user's information.

### Update a User's Details

Modify details of an existing user, such as their username, email, or password.

#### Request

```bash
$ curl -X PUT http://localhost:8000/api/users//<int:pk>/ \
     -H "Content-Type: application/json" \
     -H "Authorization: Token your_access_token_here" \
     -d '{"username": "updated_username", "email": "updated_email@example.com"}'
```

#### Response

JSON representation of the user after updates have been applied.

### Delete a User

Remove a user account from the TEA Platform. This action is irreversible and should be used with caution.

#### Request

```bash
$ curl -X DELETE http://localhost:8000/api/users//<int:pk>/ \
     -H "Authorization: Token your_access_token_here"
```

#### Response

HTTP 204 No Content on successful deletion, confirming the user account has been removed.

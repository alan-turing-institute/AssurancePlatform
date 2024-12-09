---
sidebar_position: 1
sidebar_label: 'Authentication'
---

# Authentication Endpoints

Authentication is crucial for accessing the TEA Platform's features. This section covers the endpoints required for logging in, logging out, and registering a new account. Each request and response is JSON-formatted.

## Login

To authenticate a user and receive an access token for subsequent requests, use the `/api/auth/login/` endpoint. This token should be included in the Authorization header as a Bearer token for API calls that require authentication.

### Request

```bash
$ curl -X POST http://localhost:8000/api/auth/login/ \
     -H "Content-Type: application/json" \
     -d '{"username": "your_username", "password": "your_password"}'
```

### Response

```json
{
    "token": "your_token"
}
```

## Logout

To log out a user and invalidate the current token, use the `/api/auth/logout/` endpoint. Note that this requires an authenticated request.

### Request

```bash
$ curl -X POST http://localhost:8000/api/auth/logout/ \
     -H "Authorization: Token your_access_token_here"
```

### Response

A successful logout will return a 200 OK status with no content.

## Registration

To create a new user account, submit a request to `/api/auth/register/` with the required user information. Upon successful registration, the user will be authenticated automatically, and an access token will be returned.

### Request

```bash
$ curl -X POST http://localhost:8000/api/auth/register/ \
     -H "Content-Type: application/json" \
     -d '{
           "username": "new_user",
           "email": "new_user@example.com",
           "password1": "complex_password",
           "password2": "complex_password"
         }'
```

Response:

```json
{
  "key": "your_new_access_token_here"
}
```

This token is used just like the login token for authenticated requests.

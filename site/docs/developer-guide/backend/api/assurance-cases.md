# Assurance Case Endpoints

The TEA Platform provides comprehensive endpoints for managing assurance cases and their elements, including goals, contexts, property claims, and strategies. This section details how to interact with these resources via the API.

Replace `<int:pk>`, `<case_id>`, `<goal_id>` with the appropriate integer identifiers for your assurance cases, goals, etc., and your_access_token_here with your actual access token received after authentication.

The `curl` examples in the following serve as a quick way to test and interact with the TEA Platform API directly from your command line.

## Case List & Management

### List All Assurance Cases

#### Request

```bash
curl -X GET http://localhost:8000/api/cases/ \
     -H "Authorization: Token your_access_token_here"
```

#### Response

A JSON array of assurance cases, each with its details.

### Create a New Assurance Case

#### Request

```bash
curl -X POST http://localhost:8000/api/cases/ \
     -H "Content-Type: application/json" \
     -H "Authorization: Token your_access_token_here" \
     -d '{"name": "Case Name", "description": "Case Description", "lock_uuid": "", "color_profile": "default"}'
```

#### Response

JSON object of the created assurance case.

### Retrieve Details of a Specific Assurance Case

#### Request

```bash
curl -X GET http://localhost:8000/api/cases/<int:pk>/ \
     -H "Authorization: Token your_access_token_here"
```

Response:

JSON object of the specified assurance case.

### Update an Assurance Case

#### Request

```bash
curl -X PUT http://localhost:8000/api/cases/<int:pk>/ \
     -H "Content-Type: application/json" \
     -H "Authorization: Token your_access_token_here" \
     -d '{"name": "Updated Case Name", "description": "Updated Case Description"}'
```

Response:

JSON object of the updated assurance case.

### Delete an Assurance Case

#### Request

```bash
curl -X DELETE http://localhost:8000/api/cases/<int:pk>/ \
     -H "Authorization: Token your_access_token_here"
```

#### Response

HTTP 204 No Content on successful deletion.

## Elements

### Goal Endpoints

#### List All Goals

```bash
curl -X GET http://localhost:8000/api/goals/ \
     -H "Authorization: Token your_access_token_here"
```

#### Create a New Goal

```bash
curl -X POST http://localhost:8000/api/goals/ \
     -H "Content-Type: application/json" \
     -H "Authorization: Token your_access_token_here" \
     -d '{"name": "Goal Name", "description": "Goal Description", "assurance_case": <case_id>}'
```

#### Update a Goal Element

To update an existing goal element in an assurance case, use the PUT method at the `/goals/<int:pk>/` endpoint. This request allows you to modify the name, description, or associated assurance case of the goal.

##### Request

```bash
curl -X PUT http://localhost:8000/api/goals/<int:pk>/ \
     -H "Content-Type: application/json" \
     -H "Authorization: Token your_access_token_here" \
     -d '{"name": "Updated Goal Name", "description": "Updated Goal Description"}'
```

##### Response

A JSON object containing the updated details of the goal.

#### Delete a Goal Element

To delete a specific goal element from an assurance case, send a DELETE request to the `/goals/<int:pk>/` endpoint.

##### Request

```bash
curl -X DELETE http://localhost:8000/api/goals/<int:pk>/ \
     -H "Authorization: Token your_access_token_here"
```

##### Response

HTTP 204 No Content on successful deletion, indicating the goal has been removed.

### Context Endpoints

#### List All Contexts

```bash
curl -X GET http://localhost:8000/api/contexts/ \
     -H "Authorization: Token your_access_token_here"
```

#### Create a New Context

```bash
curl -X POST http://localhost:8000/api/contexts/ \
     -H "Content-Type: application/json" \
     -H "Authorization: Token your_access_token_here" \
     -d '{"name": "Context Name", "description": "Context Description", "goal": <goal_id>}'
```

#### Update a Context Element

To update details of a context element linked to a goal, utilize the PUT method at the `/contexts/<int:pk>/` endpoint.

##### Request

```bash
curl -X PUT http://localhost:8000/api/contexts/<int:pk>/ \
     -H "Content-Type: application/json" \
     -H "Authorization: Token your_access_token_here" \
     -d '{"name": "Updated Context Name", "description": "Updated Context Description"}'
```

##### Response

JSON representation of the context with the updated information.

#### Delete a Context Element

Remove a context element by sending a DELETE request to `/contexts/<int:pk>/`.

##### Request

```bash
curl -X DELETE http://localhost:8000/api/contexts/<int:pk>/ \
     -H "Authorization: Token your_access_token_here"
```

##### Response

HTTP 204 No Content, confirming the context has been successfully deleted.

### Property Claim Endpoints

#### List All Property Claims

```bash
curl -X GET http://localhost:8000/api/propertyclaims/ \
     -H "Authorization: Token your_access_token_here"
```

#### Create a New Property Claim

```bash
curl -X POST http://localhost:8000/api/propertyclaims/ \
     -H "Content-Type: application/json" \
     -H "Authorization: Token your_access_token_here" \
     -d '{"name": "Property Claim Name", "description": "Property Claim Description", "goal": <goal_id>}'
```

#### Update a Property Claim Element

Property claims can be updated by sending a PUT request to `/propertyclaims/<int:pk>/`.

##### Request

```bash
curl -X PUT http://localhost:8000/api/propertyclaims//<int:pk>/ \
     -H "Content-Type: application/json" \
     -H "Authorization: Token your_access_token_here" \
     -d '{"name": "Updated Claim Name", "description": "Updated Claim Description"}'
```

##### Response

The API responds with the updated property claim details in JSON format.

#### Delete a Property Claim Element

To delete a property claim, issue a DELETE command to `/propertyclaims/<int:pk>/`.

##### Request

```bash
curl -X DELETE http://localhost:8000/api/propertyclaims//<int:pk>/ \
     -H "Authorization: Token your_access_token_here"
```

##### Response

HTTP 204 No Content upon successful removal of the property claim.

### Strategy Endpoints

#### List All Strategies

```bash
curl -X GET http://localhost:8000/api/strategies/ \
     -H "Authorization: Token your_access_token_here"
```

#### Create a New Strategy

```bash
curl -X POST http://localhost:8000/api/strategies/ \
     -H "Content-Type: application/json" \
     -H "Authorization: Token your_access_token_here" \
     -d '{"name": "Strategy Name", "description": "Strategy Description", "goal": <goal_id>}'
```

#### Update a Strategy Element

Modify an existing strategy by using the PUT method on `/strategies/<int:pk>/`.

##### Request

```bash
curl -X PUT http://localhost:8000/api/strategies//<int:pk>/ \
     -H "Content-Type: application/json" \
     -H "Authorization: Token your_access_token_here" \
     -d '{"name": "Updated Strategy Name", "description": "Updated Strategy Description"}'
```

##### Response

A JSON object representing the strategy after updates have been applied.

#### Delete a Strategy Element

Remove a strategy from an assurance case by sending a DELETE request to `/strategies/<int:pk>/`.

##### Request

```bash
curl -X DELETE http://localhost:8000/api/strategies//<int:pk>/ \
     -H "Authorization: Token your_access_token_here"
```

##### Response

HTTP 204 No Content, indicating the strategy has been deleted successfully.

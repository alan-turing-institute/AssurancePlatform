## API for the Assurance Platform backend

The API endpoints in this document should be appended to a BASE_URL, which will depend on where you deploy the app.
If you are developing/running locally, BASE_URL will be `http://localhost:8000/api`.   
If you deploy to e.g. Azure, it will be something like `https://<your-azure-app-name>.azurewebsites.net/api`.

### `/cases/`
* A GET request will list the available AssuranceCases: 
    - returns `[{name: <str:case_name>, id: <int:case_id>}, ...]`
* A POST request will create a new AssuranceCase.  
    - Payload: `{'name': <str:case_name>, 'description': <str:description>}`
    - returns `{name: <str:case_name>, id: <int:case_id>}`

### `/cases/<int:case_id>`
* A GET request will get the details of the specified AssuranceCase: 
    - returns `{name: <str:case_name>, id: <int:case_id>, description: <str:description>, created_date: <datetime:date>, goals: [<int:goal_ids>]}`
* A PUT request will modify new AssuranceCase.  
    - Payload: Any key/value pair from the AssuranceCase schema
    - returns `{name: <str:case_name>, id: <int:case_id>, description: <str:description>, created_date: <datetime:date>, goals: [<int:goal_ids>]}`
* A DELETE request will delete the specified AssuranceCase.
    - returns `[{name: <str:case_name>, id: <int:case_id>}, ...]` listing remaining AssuranceCases

### `/goals/`
* A GET request will list the available TopLevelNormativeGoals: 
    - returns `[{name: <str:goal_name>, id: <int:goal_id>}, ...]`
* A POST request will create a new TopLevelNormativeGoal.  
    - Payload: `{name: <str:goal_name>, short_description: <str:description>, long_description : <str:description>, keywords: <str:keywords>, assurance_case_id: <int:case_id>}`
    - returns `{name: <str:goal_name>, id: <int:goal_id>}`

### `/goals/<int:goal_id>`
* A GET request will get the details of the specified TopLevelNormativeGoal: 
    - returns `{name: <str:goal_name>, id: <int:goal_id>, short_description: <str:description>, long_description: <str:description>, keywords: <str:keywords>, contexts: [<int:context_ids>], system_description: [<int:system_description_id>], assurance_case: <dict:serialized_assurance_case>, shape: <str:shape>}`
* A PUT request will modify the specified TopLevelNormativeGoal.  
    - Payload: Any key/value pair from the TopLevelNormativeGoal schema
    - returns `{name: <str:goal_name>, id: <int:goal_id>, short_description: <str:description>, long_description: <str:description>,  keywords: <str:keywords>, contexts: [<int:context_ids>], system_description: [<int:system_description_id>], assurance_case,: <dict:serialized_assurance_case>, shape: <str:shape>}`
* A DELETE request will delete the specified TopLevelNormativeGoal.
    - returns `[{name: <str:goal_name>, id: <int:goal_id>}, ...]` listing remaining TopLevelNormativeGoals

### `/contexts/`
* A GET request will list the available Contexts: 
    - returns `[{name: <str:context_name>, id: <int:context_id>}, ...]`
* A POST request will create a new Context.  
    - Payload: `{name: <str:context_name>, short_description: <str:description>, long_description : <str:description>, goal_id: <int:goal_id>}`
    - returns `{name: <str:context_name>, id: <int:context_id>}`

### `/contexts/<int:context_id>`
* A GET request will get the details of the specified Context: 
    - returns `{name: <str:context_name>, id: <int:context_id>, short_description: <str:description>, long_description: <str:description>, goal: <dict:serialized_toplevelnormativegoal>, shape: <str:shape>}`
* A PUT request will modify the specified Context.  
    - Payload: dict containing any key/value pairs from the Context schema
    - returns `{name: <str:context_name>, id: <int:context_id>, short_description: <str:description>, long_description: <str:description>,   goal: <dict:serialized_toplevelnormativegoal>}`
* A DELETE request will delete the specified Context.
    - returns `[{name: <str:context_name>, id: <int:context_id>}, ...]` listing remaining Contexts

### `/descriptions/`
* A GET request will list the available SystemDescriptions: 
    - returns `[{name: <str:description_name>, id: <int:description_id>}, ...]`
* A POST request will create a new SystemDescription.  
    - Payload: `{name: <str:description_name>, short_description: <str:description>, long_description : <str:description>, goal_id: <int:goal_id>}`
    - returns `{name: <str:description_name>, id: <int:description_id>}`

### `/descriptions/<int:description_id>`
* A GET request will get the details of the specified SystemDescription: 
    - returns `{name: <str:description_name>, id: <int:description_id>, short_description: <str:description>, long_description: <str:description>, goal: <dict:serialized_toplevelnormativegoal>, shape: <str:shape>}`
* A PUT request will modify the specified SystemDescription.  
    - Payload: dict containing any key/value pairs from the SystemDescription schema
    - returns `{name: <str:description_name>, id: <int:description_id>, short_description: <str:description>, long_description: <str:description>,   goal: <dict:serialized_toplevelnormativegoal>}`
* A DELETE request will delete the specified SystemDescription.
    - returns `[{name: <str:description_name>, id: <int:description_id>}, ...]` listing remaining SystemDescriptions

### `/propertyclaims/`
* A GET request will list the available PropertyClaims: 
    - returns `[{name: <str:claim_name>, id: <int:claim_id>}, ...]`
* A POST request will create a new PropertyClaim.  
    - Payload: `{name: <str:claim_name>, short_description: <str:description>, long_description : <str:description>, goal_id: <int:goal_id>}`
    - returns `{name: <str:claim_name>, id: <int:claim_id>}`

### `/propertyclaims/<int:claim_id>`
* A GET request will get the details of the specified PropertyClaim: 
    - returns `{name: <str:claim_name>, id: <int:claim_id>, short_description: <str:description>, long_description: <str:description>, goal: <dict:serialized_toplevelnormativegoal>, arguments: [<int:argument_id>], shape: <str:shape>}`
* A PUT request will modify the specified PropertyClaim.  
    - Payload: dict containing any key/value pairs from the PropertyClaim schema
    - returns `{name: <str:claim_name>, id: <int:claim_id>, short_description: <str:description>, long_description: <str:description>,   goal: <dict:serialized_toplevelnormativegoal>}`
* A DELETE request will delete the specified PropertyClaim.
    - returns `[{name: <str:claim_name>, id: <int:claim_id>}, ...]` listing remaining PropertyClaims

### `/arguments/`
* A GET request will list the available Arguments: 
    - returns `[{name: <str:argument_name>, id: <int:argument_id>}, ...]`
* A POST request will create a new Argument.  
    - Payload: `{name: <str:argument_name>, short_description: <str:description>, long_description : <str:description>, property_claim_id: [<int:claim_ids>]}`
    - returns `{name: <str:argument_name>, id: <int:argument_id>}`

### `/arguments/<int:argument_id>`
* A GET request will get the details of the specified Argument: 
    - returns `{name: <str:argument_name>, id: <int:argument_id>, short_description: <str:description>, long_description: <str:description>, property_claim: [<dict:serialized_propertyclaim>], evidential_claims: [<int:claim_ids>], shape: <str:shape>}`
* A PUT request will modify the specified Argument.  
    - Payload: dict containing any key/value pairs from the Argument schema
    - returns `{name: <str:argument_name>, id: <int:argument_id>, short_description: <str:description>, long_description: <str:description>,   property_claim: [<dict:serialized_propertyclaim>]}`
* A DELETE request will delete the specified Argument.
    - returns `[{name: <str:argument_name>, id: <int:argument_id>}, ...]` listing remaining Arguments

### `/evidentialclaims/`
* A GET request will list the available EvidentialClaims: 
    - returns `[{name: <str:claim_name>, id: <int:claim_id>}, ...]`
* A POST request will create a new PropertyClaim.  
    - Payload: `{name: <str:claim_name>, short_description: <str:description>, long_description : <str:description>, argument_id: <int:argument_id>}`
    - returns `{name: <str:claim_name>, id: <int:claim_id>}`

### `/evidentialclaims/<int:claim_id>`
* A GET request will get the details of the specified EvidentialClaim: 
    - returns `{name: <str:claim_name>, id: <int:claim_id>, short_description: <str:description>, long_description: <str:description>, argument: <dict:serialized_argument>, evidence: [<int:evidence_id>], shape: <str:shape>}`
* A PUT request will modify the specified EvidentialClaim.  
    - Payload: dict containing any key/value pairs from the EvidentialClaim schema
    - returns `{name: <str:claim_name>, id: <int:claim_id>, short_description: <str:description>, long_description: <str:description>,   argument: <dict:serialized_argument>}`
* A DELETE request will delete the specified EvidentialClaim.
    - returns `[{name: <str:claim_name>, id: <int:claim_id>}, ...]` listing remaining EvidentialClaims

### `/evidence/`
* A GET request will list the available Evidence objects: 
    - returns `[{name: <str:evidence_name>, id: <int:evidence_id>}, ...]`
* A POST request will create a new Evidence.  
    - Payload: `{name: <str:evidence_name>, short_description: <str:description>, long_description : <str:description>, evidencial_claim_id: [<int:goal_id>]}`
    - returns `{name: <str:evidence_name>, id: <int:evidence_id>}`

### `/evidence/<int:evidence_id>`
* A GET request will get the details of the specified Evidence: 
    - returns `{name: <str:evidence_name>, id: <int:evidence_id>, short_description: <str:description>, long_description: <str:description>, URL: <str:url>, evidential_claim: [<dict:serialized_evidentialclaim>], shape: <str:shape>}`
* A PUT request will modify the specified Evidence.  
    - Payload: dict containing any key/value pairs from the Evidence schema
    - returns `{name: <str:claim_name>, id: <int:claim_id>, short_description: <str:description>, long_description: <str:description>, URL: <str:url>, evidential_claim: [<dict:serialized_evidentialclaim>]}`
* A DELETE request will delete the specified Evidence.
    - returns `[{name: <str:evidence_name>, id: <int:evidence_id>}, ...]` listing remaining Evidence

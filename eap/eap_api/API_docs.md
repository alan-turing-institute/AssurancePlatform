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

### `/cases/<case_id>`
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

### `/goals/<goal_id>`
* A GET request will get the details of the specified TopLevelNormativeGoal: 
    - returns `{name: <str:goal_name>, id: <int:goal_id>, short_description: <str:description>, long_description: <str:description>, keywords: <str:keywords>, contexts: [<int:context_ids>], system_description: [<int:system_description_id>], assurance_case: <dict:serialized_assurance_case>, shape: <str:shape>>}`
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

### `/contexts/<context_id>`
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


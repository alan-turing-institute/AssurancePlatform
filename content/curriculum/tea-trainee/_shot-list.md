# Screenshot shot list

Capture these from the running staging application with practice data. The code establishes controls and routes, but precise layout needs a visual check.

### m2-01
- Page: curriculum/tea-trainee/02-brewing-your-own-tea/exploration.md, step 1
- Route: /login
- Set up: signed out
- Show: identifier and password fields, Login, Google and GitHub choices
- Caption: The sign-in form with account options
- Uncertain: provider buttons and fields may shift with viewport width

### m2-02
- Page: curriculum/tea-trainee/02-brewing-your-own-tea/exploration.md, step 2
- Route: /dashboard
- Set up: open Create new case; enter Fair Recruitment AI and a practice description
- Show: Create New Assurance Case with Name, Description and Submit
- Caption: The case creation dialog with name and description
- Uncertain: exact dashboard card position

### m2-03
- Page: curriculum/tea-trainee/02-brewing-your-own-tea/exploration.md, step 3
- Route: /case/<id>
- Set up: new practice case; use the Edit element pencil on G1 and type the goal before submitting
- Show: G1 description and Update Goal
- Caption: The goal editor containing the fairness goal
- Uncertain: none; the Edit element pencil opens the dialog

### m2-04
- Page: curriculum/tea-trainee/02-brewing-your-own-tea/exploration.md, step 4
- Route: /case/<id>
- Set up: open G1 and add the two context entries
- Show: Context section with the fairness and recruitment boundaries
- Caption: Context entries attached to the top-level goal
- Uncertain: entry wrapping at the capture width

### m2-05
- Page: curriculum/tea-trainee/02-brewing-your-own-tea/exploration.md, step 5
- Route: /case/<id>
- Set up: G1 saved; open its Add Element control
- Show: the + button labelled Add child element and Add Strategy in its popover
- Caption: The Add child element button and strategy option on the goal
- Uncertain: trigger icon and menu placement depend on canvas position

### m2-06
- Page: curriculum/tea-trainee/02-brewing-your-own-tea/exploration.md, step 6
- Route: /case/<id>
- Set up: add a strategy and then a dataset-audit property claim
- Show: the property claim beneath the strategy
- Caption: A property claim beneath the strategy
- Uncertain: automatic diagram layout and generated name

### m2-07
- Page: curriculum/tea-trainee/02-brewing-your-own-tea/exploration.md, step 7
- Route: /case/<id>
- Set up: add an evidence description under the property claim, with no invented URL
- Show: the evidence element and its link to the property claim
- Caption: Evidence linked beneath the property claim
- Uncertain: automatic diagram layout and generated name

### m2-08
- Page: curriculum/tea-trainee/02-brewing-your-own-tea/exploration.md, step 8
- Route: /case/<id>
- Set up: use the Edit element pencil on the property claim after creation
- Show: Description, Assertion status and Update Property in the edit dialog
- Caption: The property claim edit dialog and assertion status
- Uncertain: none; the Edit element pencil opens the dialog

### m2-09
- Page: curriculum/tea-trainee/02-brewing-your-own-tea/exploration.md, step 9
- Route: /case/<id>
- Set up: completed practice branch; choose Export from the toolbar
- Show: Export Case with raw JSON, image and report options
- Caption: The Export Case dialog showing export choices
- Uncertain: which export sections fit in one viewport

### m4-01
- Page: curriculum/tea-trainee/04-drinking-tea-with-others/exploration.md, Teams and roles
- Route: /dashboard/teams
- Set up: practice account with no sensitive team names
- Show: team list and New Team control
- Caption: The teams dashboard and New Team control
- Uncertain: layout when the account has no teams

### m4-02
- Page: curriculum/tea-trainee/04-drinking-tea-with-others/exploration.md, Share the working case
- Route: /case/<id>
- Set up: practice case owner; open Share Case with a practice team available
- Show: person and team sharing areas and permission selector; Share is available to the owner or a case Admin
- Caption: The Share Case dialog with people, teams and permission levels
- Uncertain: whether all sections fit in one capture

### m4-03
- Page: curriculum/tea-trainee/04-drinking-tea-with-others/exploration.md, Comment and see changes
- Route: /case/<id>
- Set up: two practice accounts with case access; one comments on an element
- Show: comment near the element and the other account's change notice
- Caption: An element comment and a second viewer's update notice
- Uncertain: timing and placement of the transient notice; capture from the second account

### m4-04
- Page: curriculum/tea-trainee/04-drinking-tea-with-others/exploration.md, Publish to Discover
- Route: /case/<id> and /discover/<slug>
- Set up: disposable complete practice case that is safe to publish
- Show: publishing control and resulting public page, as two frames if needed
- Caption: The publishing control and public Discover result
- Uncertain: exact publish-flow screen sequence and slug generated for the case

### m4-05
- Page: curriculum/tea-trainee/04-drinking-tea-with-others/exploration.md, Import and back up
- Route: /dashboard and /case/<id>
- Set up: practice account with Google Drive connected
- Show: Import File choices and Backup to Google Drive, as two frames if needed
- Caption: The import choices and Google Drive backup control
- Uncertain: provider connection state and whether both controls fit in one frame

### m4-06
- Page: curriculum/tea-trainee/04-drinking-tea-with-others/exploration.md, Integrate a machine client
- Route: /dashboard/settings/integrations
- Set up: practice integration with a non-sensitive name and a case grant; hide token secrets
- Show: integration status, scopes, token prefix and case access
- Caption: An integration card with scopes, tokens and case access
- Uncertain: expanded card layout and scroll position

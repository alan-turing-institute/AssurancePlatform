# Screenshot shot list

Capture these from a local production build on a throwaway database, with practice data.
The code establishes controls and routes, but precise layout needs a visual check.

The current pictures were taken at 1280 pixels wide in the light theme, at device scale 2.
Each file is therefore twice the pixel size of what it shows on screen.
They use one practice account (`practice_trainee`) and a second one (`practice_reviewer`) for the shared-case frames.
Dialogs taller than the screen were captured with a taller window, except the Export Case dialog, which still scrolls (see m2-09).
Requests to anything other than the local server were blocked during capture.

### m2-01
- Page: curriculum/tea-trainee/02-brewing-your-own-tea/exploration.md, step 1
- Route: /login
- Set up: signed out, with the practice username and password typed in so the field hints are hidden
- Show: identifier and password fields, Login, Google and GitHub choices
- Caption: The sign-in form with account options
- Uncertain: provider buttons and fields may shift with viewport width

### m2-02
- Page: curriculum/tea-trainee/02-brewing-your-own-tea/exploration.md, step 2
- Route: /dashboard
- Set up: open Create new case (on a dashboard with no cases the button reads New Case); leave Start from on A blank case; enter Fair Recruitment AI and a practice description
- Show: Create New Assurance Case with Start from, Name, Description and Submit
- Caption: The case creation dialog with name and description
- Uncertain: exact dashboard card position

### m2-03
- Page: curriculum/tea-trainee/02-brewing-your-own-tea/exploration.md, step 3
- Route: /case/<id>
- Set up: new practice case; use the Edit element pencil on G1 and type the goal before submitting
- Show: the whole dialog: the To fill in hint, G1 description, Terms you can use here, Assumption, Justification, Assertion status, Context and Update Goal
- Caption: The goal editor containing the fairness goal
- Uncertain: none; the Edit element pencil opens the dialog

### m2-04
- Page: curriculum/tea-trainee/02-brewing-your-own-tea/exploration.md, step 4
- Route: /case/<id>
- Set up: open G1 with the Edit element pencil and add the two context entries, worded short enough to fit on one line
- Show: Context section with the fairness and recruitment boundaries, down to Update Goal
- Caption: Context entries attached to the top-level goal
- Uncertain: entry wrapping at the capture width

### m2-05
- Page: curriculum/tea-trainee/02-brewing-your-own-tea/exploration.md, step 5
- Route: /case/<id>
- Set up: G1 saved; open its Add Element control
- Show: the + button labelled Add child element and its Add element popover (Add Strategy, Add Property Claim, Add Defeater, Add Away Goal, Add Module)
- Caption: The Add child element button and strategy option on the goal
- Uncertain: trigger icon and menu placement depend on canvas position

### m2-06
- Page: curriculum/tea-trainee/02-brewing-your-own-tea/exploration.md, step 6
- Route: /case/<id>
- Set up: add a strategy and then a dataset-audit property claim; zoom the canvas out one step so both nodes fit
- Show: the strategy and the property claim beneath it, which still carries the Unsupported badge
- Caption: A property claim beneath the strategy
- Uncertain: automatic diagram layout and generated name

### m2-07
- Page: curriculum/tea-trainee/02-brewing-your-own-tea/exploration.md, step 7
- Route: /case/<id>
- Set up: add an evidence description under the property claim, with no invented URL; drag the canvas so both nodes clear the toolbar
- Show: the property claim and the evidence element beneath it, joined by a line (the claim no longer shows Unsupported)
- Caption: Evidence linked beneath the property claim
- Uncertain: automatic diagram layout and generated name

### m2-08
- Page: curriculum/tea-trainee/02-brewing-your-own-tea/exploration.md, step 8
- Route: /case/<id>
- Set up: use the Edit element pencil on the property claim after creation
- Show: Description, Assertion status, Context and Update Property in the edit dialog
- Caption: The property claim edit dialog and assertion status
- Uncertain: none; the Edit element pencil opens the dialog

### m2-09
- Page: curriculum/tea-trainee/02-brewing-your-own-tea/exploration.md, step 9
- Route: /case/<id>
- Set up: completed practice branch; choose Export from the toolbar; use a tall window (about 1290 pixels high), because the dialog's contents scroll
- Show: Export Case with raw JSON, image and report options (Backup to Google Drive is further down the scroll area)
- Caption: The Export Case dialog showing export choices
- Uncertain: which export sections fit in one viewport

### m4-01
- Page: curriculum/tea-trainee/04-drinking-tea-with-others/exploration.md, Teams and roles
- Route: /dashboard/teams
- Set up: practice account with one team, Practice Review Group
- Show: team list and New Team control
- Caption: The teams dashboard and New Team control
- Uncertain: layout when the account has no teams

### m4-02
- Page: curriculum/tea-trainee/04-drinking-tea-with-others/exploration.md, Share the working case
- Route: /case/<id>
- Set up: practice case owner; share the case by email with the second practice account and with Practice Review Group, both at Can view; reopen Share Case
- Show: the Share by Email form with its permission selector, then People with access and Teams with access; Share is available to the owner or a case Admin
- Caption: The Share Case dialog with people, teams and permission levels
- Uncertain: whether all sections fit in one capture

### m4-03
- Page: curriculum/tea-trainee/04-drinking-tea-with-others/exploration.md, Comment and see changes
- Route: /case/<id>
- Set up: two practice accounts; the second has view access and has the comments panel for G1 open; the owner then adds a comment on G1
- Show: the comment in the panel and the other account's change notice (bottom right, visible for about four seconds)
- Caption: An element comment and a second viewer's update notice
- Uncertain: timing and placement of the transient notice; capture from the second account

### m4-04
- Page: curriculum/tea-trainee/04-drinking-tea-with-others/exploration.md, Publish to Discover
- Route: /case/<id> and /discover/<slug>
- Set up: practice case with its case information complete (description, author, sector); open the Draft badge, then publish
- Show: the status dialog with Publish above the top of the public /discover/<slug> page, as two frames in one picture
- Caption: The publishing control and public Discover result
- Uncertain: exact publish-flow screen sequence and slug generated for the case

### m4-05
- Page: curriculum/tea-trainee/04-drinking-tea-with-others/exploration.md, Import and back up
- Route: /dashboard and /case/<id>
- Set up: Import Case on its default File tab; Export Case scrolled to the end (the practice account is not connected to Google, so that section offers Sign in with Google)
- Show: Import File choices above the Backup to Google Drive section, as two frames in one picture
- Caption: The import choices and Google Drive backup control
- Uncertain: provider connection state and whether both controls fit in one frame

### m4-06
- Page: curriculum/tea-trainee/04-drinking-tea-with-others/exploration.md, Integrate a machine client
- Route: /dashboard/settings/integrations
- Set up: practice integration with a non-sensitive name, three scopes, one issued token (the card shows only its prefix; close the secret dialog without capturing it) and a case grant; grant form closed
- Show: integration status, scopes, token prefix and case access
- Caption: An integration card with scopes, tokens and case access
- Uncertain: expanded card layout and scroll position

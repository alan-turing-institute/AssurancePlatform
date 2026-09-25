---
title: First-case screen-recording script
description: Record the module 2 walkthrough as a five to eight minute demonstration.
---

## Recording set-up

Use a practice account with no sensitive cases. Prepare a short description of the Fair Recruitment AI teaching example. Record the browser at readable zoom. Show the mouse action, then pause briefly for the resulting screen. Target about seven minutes. The nine matching stills are specified in `shot-list.md`.

## Action and narration

| Action on screen | Narration |
| --- | --- |
| **0:00–0:35.** Open `/login`, show the email or username and password form, **Login**, Google and GitHub choices, then sign in. | “You can sign in with your account details or a configured provider. I will use a practice account. This session opens my dashboard.” |
| **0:35–1:15.** On `/dashboard`, choose **Create new case**. Enter Fair Recruitment AI, a short practice description, and **Submit**. | “The case creator asks for a name and description. It starts a blank working case and opens the editor. There is no template selector in this dialog.” |
| **1:15–1:55.** Use the **Edit element** pencil on `G1`, replace its placeholder with the fairness goal, and choose **Update Goal**. | “The platform already created the top-level goal, G1. I am stating what this case aims to justify. Writing a goal does not prove it.” |
| **1:55–2:35.** Use **Edit element** on `G1` again, add the fairness and recruitment context entries, and update it. | “Context says how to read the goal: which definition of fairness and which use setting. It bounds the argument.” |
| **2:35–3:15.** Select the goal's **+** (Add child element) button, choose **Add Strategy**, describe discrimination prevention and choose **Add**. | “A strategy gives the approach for supporting the goal. The editor assigns its numbered name.” |
| **3:15–4:05.** Select the strategy's **+** (Add child element) button, choose **Add Property Claim**, enter the dataset-audit statement, and add it. | “This statement is narrower and testable. It supports part of the strategy, not every part of fairness.” |
| **4:05–4:55.** Select the claim's **+** (Add child element) button, choose **Add Evidence**, describe the practice report and show the optional reference field. | “Evidence should point to an inspectable artefact. I will not invent a real report link for a teaching example.” |
| **4:55–5:50.** Use the **Edit element** pencil on the claim, show **Assertion status**, adjust wording, update it, then use **Undo** and **Redo**. | “Status records your position. I can mark a claim as needing support. Each add or edit dialog saves its own change; the toolbar history controls help me check a revision.” |
| **5:50–6:45.** Choose **Export**, show JSON, image, report and Drive backup choices, export one copy, then return to the diagram. | “Export gives a review copy. I now trace G1 through strategy and claim to evidence and ask what the evidence leaves open. Sharing and publishing come in Module 4.” |

## Production note

The exact visual placement of node controls, toast messages and exported download behaviour needs a running-browser check. Capture these from the application rather than animating an assumed result.

## Sources checked

- `components/auth/sign-in-form.tsx`
- `components/cases/case-list.tsx`
- `components/modals/case-create-modal.tsx`
- `lib/services/case-fetch-service.ts`
- `components/cases/node-add-popover.tsx`
- `components/cases/add-child-trigger.tsx`
- `components/shared/nodes/node-action-group.tsx`
- `components/cases/node-edit-dialog.tsx`
- `components/cases/history-controls.tsx`
- `components/cases/action-buttons.tsx`
- `components/modals/share-modal.tsx`

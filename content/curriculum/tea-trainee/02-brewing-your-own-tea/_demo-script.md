---
title: First-case screen-recording script
description: Record the module 2 walkthrough as a six to eight minute demonstration of building a first case.
---

Every control, label and dialog title below was checked on a production build of the platform on 6 October 2026.
If the interface changes, check the script against it again before recording.

## Recording set-up

- Use a practice account with no real cases.
  Register it the day before, sign in once, dismiss the "Welcome to the New TEA Platform" notice with **Got it**, and let the dashboard tour and the tutorial-case tour run to the end, so none of them appears on camera.
  Create and delete one throwaway case so the first-case editing tour has already run too.
- Dismiss the blue feedback strip at the foot of the page (its **X**) before you start; it covers the bottom of every signed-in page.
- Light theme, the default colour preset, browser window 1920 by 1080, bookmarks bar hidden, page zoom 100 per cent.
- Have the Fair Recruitment AI texts ready to type (below).
  Type each entry; do not paste.
- Target six to eight minutes.
  The timings below add up to about six and three-quarters.
  Show the mouse action, then pause for the result before you speak over it.

Texts used in the recording:

- Case name: `Fair Recruitment AI`
- Case description: `A practice case for the TEA Trainee curriculum.`
- Goal: `The recruitment AI makes fair, non-discriminatory shortlisting recommendations.`
- Context 1: `Fairness here means equal selection rates across protected groups, within the thresholds set by the hiring policy.`
- Context 2: `The system shortlists applicants for a human recruiter; it does not make the final decision.`
- Strategy: `Argue over the main sources of discrimination: the training data and the model's outputs.`
- Property claim: `The training data has been audited for representation across protected groups.`
- Evidence: `Training-data audit report, March 2026.`

## Action and narration

| Action on screen | Narration |
| --- | --- |
| **0:00–0:30.** Open `/login`. Point out the **Email or Username** and **Password** fields, the **Login** button, and the **GitHub** and **Google** buttons under "Or continue with". Sign in with the practice account. The dashboard opens. | "You can sign in with an account or with GitHub or Google. I am using a practice account. This is the dashboard: every case you own. Cases other people share with you are under Shared With Me." |
| **0:30–1:10.** Choose the dashed **Create new case** card. In the **Create New Assurance Case** dialog, type the case name and description, then **Submit**. The case opens with a single element, G1, reading "Describe your top-level assurance goal", and a **Draft** badge top right. | "A case starts with a name and a description. There is no template to pick. The platform opens the editor with one element already there: the top-level goal, G1, waiting for its text." |
| **1:10–1:50.** On G1, use the pencil at the foot of the card (**Edit element**). The **Editing G1** dialog has two tabs, **Details** and **Evidence**. On Details, select the whole of the **Description** text and type the goal. Choose **Update Goal**. The card now shows the goal. | "The goal is the claim the whole case sets out to demonstrate. I am stating what should be true of the system. Writing it down proves nothing yet; everything below it will have to earn it." |
| **1:50–2:35.** Edit G1 again. Under **Context**, type the first entry into "Add new context..." and choose **Add**; repeat for the second. Choose **Update Goal**. Then use the chevron at the far right of G1's foot to expand the card: **CONTEXT (2)** lists both entries. | "Context says how to read the goal: which idea of fairness, and what the system actually does. Context does not support the goal; it bounds it. You see it when you expand the card." |
| **2:35–3:15.** Use the **+** at the left of G1's foot (**Add child element**). The **ADD ELEMENT** panel offers Add Strategy, Add Property Claim, Add Defeater, Add Away Goal and Add Module. Choose **Add Strategy**. In the **Add Strategy** dialog, type the strategy and choose **Add**. The new element appears beneath G1, named **S1**. | "A strategy says how the goal is broken down. This one splits the problem into the data the model learned from and what it produces. The platform numbers it for me: S1." |
| **3:15–4:00.** Use the **+** on S1. Its panel offers Add Property Claim, Add Defeater, Add Away Goal and Add Module. Choose **Add Property Claim**, type the claim, **Add**. It appears as **P1**. | "A property claim is narrower than the goal and can be true or false. This one is about the training data only. It supports one part of the strategy, not the whole of fairness." |
| **4:00–4:45.** Use the **+** on P1. Choose **Add Evidence**. In the **Add Evidence** dialog, type the description and point at the field **Evidence Link(s) (Optional)**, with its **Add URL** button, without filling it. Choose **Add**. It appears as **E1**. The tree is now four levels deep; if the top of G1 sits under the header, scroll the canvas down a little or zoom out one notch. | "Evidence is something a reader can inspect: a report, a test result, a certificate. The link field is optional, and I am leaving it empty rather than invent a document for a teaching case." |
| **4:45–5:40.** Use the pencil on P1 (**Editing P1**). Open the **Assertion status** list: Asserted, Needs support, Assumed, Axiomatic, Defeated. Choose **Needs support** and **Update Property**. The card now carries a "Needs support" badge at its top right. In the toolbar, press **Undo** (the first button): the badge disappears. Press **Redo**: it returns. | "Status records where you stand on a claim. I am marking this one as needing support until the evidence is in. Each dialog saves its own change, and undo and redo in the toolbar step back and forward through them." |
| **5:40–6:40.** Choose **Export** in the toolbar. The **Export Case** dialog has four sections: **Export Raw JSON**, **Export as Image**, **Export Report**, and, after a scroll, **Backup to Google Drive**. Scroll to **Export Report** and choose **Download PDF**; a toast reads "Export complete". Close the dialog and look at the diagram once more, from E1 up to G1. | "Export gives you a review copy: the raw data, a picture, a report, or a backup to your own Drive. Now read the case from the bottom up. The evidence supports the claim, the claim follows the strategy, and the strategy supports the goal. What the evidence leaves open is the next thing to work on. Sharing and publishing come in module 4." |

## Notes for the editor

- The sign-in page and the dashboard use the same blue, but the sign-in page is a two-column layout with an illustration and the dashboard is not; nothing to correct, just a visual jump at 0:30.
- At 1920 by 1080 the canvas re-fits after each added element.
  Once the tree has four levels the lowest card's foot can sit under the bottom toolbar; a small zoom out fixes it.
- Undo is shown on a status-only edit on purpose, so one action maps to one step back.
  Run that step once in rehearsal before recording.
- Keyboard shortcuts are shown in the Help sheet as Cmd+Z and Cmd+Shift+Z; on Linux and Windows the keys are Ctrl+Z and Ctrl+Shift+Z.
  The script uses the toolbar buttons so the recording is right on every platform.

---
title: Platform tour screen-recording script
description: Record a seven minute tour of the TEA platform for someone deciding whether and how to use it.
---

Every control, label and dialog title below was checked on a production build of the platform on 6 October 2026.
If the interface changes, check the script against it again before recording.

The tour runs in the order a new person meets the platform: sign in, the dashboard and its welcome tour, the tutorial case, the tools around a case, sharing, publishing, the health plugin, and the documentation.
It shows the platform; it does not teach assurance cases.
The first-case recording (module 2's script) does that.

## Recording set-up

Two accounts, both practice accounts with no real cases:

- **The new account.** Register it just before recording and do not sign in.
  The recording opens with its first sign-in, so the "Welcome to the New TEA Platform" notice and the dashboard tour appear on camera as a new person would see them.
- **The prepared account.** Register it the day before and set it up so the later segments have something to show.
  - One case of its own with a few elements, shared with a colleague's account with "Can view".
  - Membership of a team with at least one other member.
  - One case published to Discover, with its description, authors and sector filled in.
  - The Claim/Evidence Health plugin on (it is on by default), and one case where a property claim has accepted settings and a recent result from a pipeline, so the badge, the Evidence tab and the Evidence health panel have content.
    Pipeline results count for a limited time, so send a fresh result a few minutes before recording.
  - The feedback strip at the foot of the page dismissed, every tour run to its end, and the first-arrival notice dismissed.
  - Mode set to **Light** in the case Settings popover (the default is System).

Light theme, the default colour preset, browser window 1920 by 1080, bookmarks bar hidden, page zoom 100 per cent, developer tools closed.
The new account will show the blue feedback strip at the foot of its pages; dismiss it on camera with its **X** when it first appears, or accept it in the edit.
On Discover and the documentation, accept the cookie notice before recording; the "Research Preview" strip along the foot of Discover stays.
Target seven minutes.
The timings below add up to about seven and a half; trim the dashboard tour segment first if you need to.

## Action and narration

| Action on screen | Narration |
| --- | --- |
| **0:00–0:35. Sign in.** Open `/login`. The page offers **Email or Username** and **Password**, a **Login** button, and **GitHub** and **Google** under "Or continue with". Sign in as the new account. The dashboard opens behind a notice titled **Welcome to the New TEA Platform**. Read it for a moment and choose **Got it**. | "TEA is a platform for building, sharing and publishing assurance cases: structured arguments, backed by evidence, that a system has a property such as safety or fairness. You sign in with an account, or with GitHub or Google. This is a brand-new account, so the platform greets it." |
| **0:35–1:35. The dashboard tour.** The tour starts on its own. Step through it with **Next**: Welcome to TEA, Create a case, Import a case, Find a case, Cases shared with you, Teams, Discover, and Start with the tutorial case. Choose **Finish**. Point at the **Take the tour** button at the top of the page. | "A short tour runs the first time you arrive. It points out the two ways to start a case, how to find one, where cases that other people share with you appear, teams, and Discover, where published cases live. It ends on the tutorial case, which every new account gets. You can run the tour again from this button at any time." |
| **1:35–2:35. The tutorial case.** Open **Tutorial: Safe Chatbot Deployment**. A second tour starts; step through its eight steps (A worked example, The goal, Context and details, The strategy, The property claim, The evidence, Editing the case, Where to go next) and **Finish**. Then, without the tour: G1 is already expanded, showing **CONTEXT (3)**. Use the chevron at the foot of **S1** to expand it and show its **JUSTIFICATION**. Expand **E1** to show its **SOURCE** link. | "The tutorial case is a worked example you can explore and edit without risk. Its tour walks down the tree: a goal at the top, the context that bounds it, strategies that break it down, property claims that can be true or false, and evidence a reader can inspect. Every card expands to show what it carries." |
| **2:35–3:35. The tools around a case.** Hover the toolbar from left to right so the tooltips show. Undo and Redo stay grey until you change something; start at **Focus**, **Reset Identifiers**, **Case Information**, **Help**, then **Share**, **Export**, **JSON View**, **Notes**, **Evidence health**, **Settings**, Delete. Open **Case Information** (the sheet is titled **Update Assurance Case**) and close it. Open **Help**: the sheet lists every element type under **Elements** and every button under **Canvas options**, with **Restart the tour** and **Full documentation** at the foot. Close it. Open **Settings** and switch **Layout direction** to **Left-right**, then back to **Top-down**. | "Around the canvas is a small toolbar. Focus re-lays out the diagram and fits it to the window. Case Information holds the name, description, authors and sector. Help explains every element and every button, and can restart the tour. Export and Share are next. Settings switches the diagram between top-down and left-right, and changes the colour preset." |
| **3:35–4:25. Sharing.** Use the back arrow to return to the dashboard, sign out, and sign in as the prepared account. Open its own case and choose **Share**. The **Share Case** dialog has two tabs, **Share by Email** and **Share with Team**. On Share by Email, show the **Permission Level** list: Can view, Can comment, Can edit, Admin. **People with access** lists the owner and the colleague already added. Switch to **Share with Team** and show the team. Close. Use the back arrow to return to the dashboard, choose **Teams** in the sidebar and open the team page: members and their roles, and **Add Member**. | "You share a case with a person by email, choosing whether they can view, comment, edit or administer it, or with a whole team at once. Teams are groups of colleagues with a role each. Someone you share with sees the case under Shared With Me on their own dashboard." |
| **4:25–5:15. Publishing and Discover.** Open the prepared account's published case. The badge at the top right reads **Published**; choose it. The **Case Status: Published** dialog shows when it was published and offers **Unpublish**. Close it. Use the back arrow to return to the dashboard and choose **Discover Public Projects** in the sidebar. On **Community Case Studies**, find the case's card and open it: title, sector, authors, the description, and **Download JSON** under **Frozen snapshot**. | "A case starts as a draft that only you and the people you share it with can see. When it is ready, you publish it. Publishing takes a snapshot and lists it on Discover, where anyone can read it and download the frozen copy. The original stays yours to keep editing." |
| **5:15–6:35. The health plugin.** Go to `/dashboard`, choose the user block at the foot of the sidebar, then the **Plugins** tab. The card **Claim/Evidence Health** is on. Read its first sentence. Open the **Integrations** tab and show **Register integration**. Then open the prepared case with health data. A property claim carries a small coloured dot at its top right; hover it for **Health: passing**. Use the pencil on that claim, open the **Evidence** tab, and show **Results** (the latest result, its verdict and value) and **Settings** (the check, the accepted settings, and who accepted them). Close. In the toolbar choose **Evidence health**: the panel counts the results that never expire, the checks they belong to, and the settings that were accepted exactly as the pipeline recommended. | "TEA can take evidence from automated checks. A pipeline you register as an integration sends results to the platform; the health plugin turns them into a badge on the claim and a log you can inspect. The claim's settings say how a result is judged, and a person accepts them before they count. The case-level panel shows where results never expire and where settings were accepted without a change, which deserve a second look." |
| **6:35–7:30. The documentation.** Use the back arrow to return to the dashboard and choose **Documentation** in the sidebar. From **Welcome to TEA Documentation**, open **Platform Guide** then **Getting Started**; scroll briefly. Open **TEA Curriculum**, then **TEA Trainee**, then module 1's **Exploration** page. Scroll to the viewer. Select **G1**: the task line turns green and the inspector below the canvas reads **Goal G1**, with **What it is**, **In this case** and **On this card**. Choose the right arrow under the viewer to move to the next stage. | "The documentation has two halves. The Platform Guide is the reference for using TEA day to day. The curriculum teaches assurance cases themselves, starting with a module where you explore a case on the real canvas: select an element and the page explains what it is and how it connects. The next recording follows that module and builds a first case from scratch." |

## Notes for the editor

- Segment 2 is the longest fixed cost.
  If the whole recording runs long, show steps 1, 2 and 8 of the dashboard tour and skip the rest with **Close tour**; the narration still holds.
- The health plugin segment depends entirely on the prepared case having a recent result.
  Check the badge is showing before you press record.
- Sign-out and sign-in between segments 4 and 5 can be cut in the edit; record them anyway so the dashboard shown afterwards belongs to the right account.
- Everything in the narration is shown on screen at the time it is said.
  If a label on screen differs from this script on the day, follow the screen and change the script.

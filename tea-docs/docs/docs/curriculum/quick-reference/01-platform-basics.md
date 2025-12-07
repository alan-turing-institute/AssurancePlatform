---
title: "Platform Basics"
description: "Essential features and navigation for the TEA Platform"
sidebar_label: "Platform Basics"
sidebar_position: 2
tags:

  - quick-reference
  - platform

---
# Platform Basics

A quick reference guide to essential TEA Platform features and navigation.

## Core Features

### Creating an Assurance Case

1. **Navigate to Cases**: Click "Cases" in the main navigation
2. **Create New**: Click the "New Case" button
3. **Add Details**: Enter case name, description, and colour coding
4. **Start Building**: Begin adding goals, claims, and evidence

### Importing and Exporting

**Import a Case:**

* JSON format supported
* Click "Import" from the Cases page
* Select your JSON file

**Export a Case:**

* Open the case you want to export
* Click "Export" in the case menu
* Download as JSON for backup or sharing

### Case Elements

Quick access to add elements:

* **Goal Claim**: Top-level normative claim (usually one per case)
* **Property Claim**: Specific claims about system properties
* **Strategy**: Explanation of decomposition approach
* **Evidence**: Supporting information and data
* **Context**: Boundaries and scoping information

## Navigation

### Main Menu

* **Home** - Dashboard and recent cases
* **Cases** - View and manage all your cases
* **Templates** - Access case templates
* **Community** - Connect with other users
* **Documentation** - Access this documentation

### Case View

When viewing a case:

* **Graph View**: Visual representation of your argument structure
* **List View**: Tabular view of all elements
* **Edit Mode**: Modify elements and connections
* **Comments**: Collaborate with team members
* **Version History**: Track changes over time

## Key Shortcuts

| Action          | Shortcut                     |
| --------------- | ---------------------------- |
| Save case       | `Ctrl+S` (or `Cmd+S` on Mac) |
| Add new element | `+` key when in graph view   |
| Search cases    | `Ctrl+K` (or `Cmd+K` on Mac) |
| Zoom in/out     | Mouse wheel or pinch gesture |
| Pan view        | Click and drag background    |

## Linking Elements

### Support Links

Connect elements to show logical support:

* **Goal → Strategy**: How you'll decompose the goal
* **Goal → Property Claim**: Direct claim supporting goal
* **Strategy → Property Claim**: Claims following strategy
* **Property Claim → Property Claim**: Sub-claims supporting parent
* **Property Claim → Evidence**: Evidence supporting claim

### Context Links

Provide contextual information:

* **Goal → Context**: Scope for top-level claim
* **Property Claim → Context**: Specific context for claim
* **Strategy → Context**: Context affecting decomposition

:::tip[Visual Feedback]

The platform provides visual indicators when links are valid. Invalid connections are prevented automatically.

:::

## Collaboration Features

* **Sharing**: Invite team members to view or edit cases
* **Comments**: Add notes and discussion threads on elements
* **Version Control**: Track who made what changes and when
* **Export/Share**: Generate shareable JSON files

## Common Tasks

### Review a Case

1. Switch to graph view for visual overview
2. Check each claim has supporting evidence
3. Verify all strategies are implemented
4. Review context elements for completeness
5. Use list view to check for gaps

### Prepare for Review

1. Add comments explaining key decisions
2. Ensure all evidence has URLs or descriptions
3. Complete long descriptions for clarity
4. Export JSON as backup
5. Share case link with reviewers

### Update an Existing Case

1. Add new elements as needed
2. Update evidence with latest data
3. Revise claims if requirements changed
4. Document changes in comments
5. Review overall argument still holds

## Getting Help

* **Documentation**: Comprehensive guides in [TEA Trainee](../tea-trainee/)
* **Templates**: Pre-built structures in [Templates section](../shared/templates/)
* **Community**: Questions and discussions in [Community Support](../../community/community-support.md)
* **Glossary**: Term definitions in [Quick Reference](./03-glossary-link.md)

:::note[In-Depth Learning]

This is a quick reference. For detailed tutorials, see the [TEA Trainee curriculum](../tea-trainee/).

:::

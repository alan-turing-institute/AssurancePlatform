# TEA Curriculum Directory Structure

**Last Updated:** November 2025
**Version:** 1.0

---
## Purpose

This document describes the organizational structure of the TEA curriculum documentation. The structure has been designed to support the three-tiered learning progression (Trainee → Specialist → Expert) while providing shared resources and quick reference materials to all learners.

---
## Directory Organization

```
curriculum/
├── STRUCTURE.md                    # This file
├── index.mdx                       # Curriculum overview and navigation
│
├── shared/                        # Shared resources across all levels
│   ├── glossary.md                 # Terminology and definitions
│   ├── images/                     # Shared diagrams and illustrations
│   │   └── README.md               # Image usage guidelines
│   └── templates/                  # Downloadable templates and tools
│       ├── evidence-quality-rubric.md
│       ├── reflection-template.md
│       ├── peer-review-checklist.md
│       ├── team-collaboration-agreement.md
│       └── case-structure-template.json
│
├── quick-reference/                # Quick reference guides
│   ├── index.md                    # Quick reference overview
│   ├── 01-platform-basics.md       # Essential platform features
│   ├── 02-element-types.md         # Quick guide to all element types
│   └── 03-glossary-link.md         # Link to main glossary
│
├── tea-trainee/                    # TEA Trainee level (Foundation)
│   ├── index.md                    # Stage overview
│   ├── 01-first-sip.md             # Module 1
│   └── exercises/                  # Trainee-level practice exercises
│
├── tea-specialist/                 # TEA Specialist level (Application)
│   ├── index.md                    # Stage overview
│   └── exercises/                  # Specialist-level exercises
│
├── tea-expert/                     # TEA Expert level (Advanced)
│   ├── index.md                    # Stage overview
│   └── exercises/                  # Expert-level exercises
│
├── hands-on/                       # Practical hands-on resources
│   └── index.md                    # Hands-on resources overview
│
└── standalone/                     # Standalone learning resources
    ├── index.md                    # Standalone resources overview
    ├── standards.md                # Standards and their role
    └── assurance-ecosystem.md      # Understanding the ecosystem
```

---
## Naming Conventions

### Module Files

**Format:** `NN-descriptive-name.md`

* `NN`: Two-digit number (01, 02, 03, etc.) for sequential ordering
* `descriptive-name`: Kebab-case descriptive name matching the module theme
* Extension: `.md` for standard Markdown, `.mdx` for MDX with React components

**Examples:**

* `01-first-sip.md` - Module 1: Your First Sip of TEA
* `02-brewing-tea.md` - Module 2: Brewing Your Own TEA
* `03-steep-tea.md` - Module 3: Letting the TEA Steep

### Directory Names

* Use lowercase with hyphens for multi-word names
* Prefix with underscore (`_`) for non-navigable utility directories (e.g., `shared`)
* Group related content logically

---
## Content Guidelines

### Frontmatter Structure

All curriculum modules should include standardized frontmatter:

```yaml
---
title: [Module Title]
description: [Brief description]
level: [trainee|specialist|expert]
module_number: [Number]
estimated_time: [Duration in minutes]
sidebar_position: [Number]
sidebar_label: [Optional custom label]
---
```

### Component Imports

Use **absolute paths** for all component imports:

```javascript
// Correct
import { CardComponent } from "/components/card";

// Incorrect
import { CardComponent } from "../../../components/card";
```

### Cross-References

* Use relative paths for internal documentation links
* Reference files by their actual filename (including number prefix)
* Test all links before committing

**Examples:**

```markdown
[See Module 2](./02-brewing-tea.md)
[Standards Guide](../standalone/standards.md)
[Shared Glossary](../shared/glossary.md)
```

---
## Shared Resources (`shared/`)

### Purpose

The `shared/` directory contains resources used across multiple curriculum levels, avoiding duplication and ensuring consistency.

### Contents

**`glossary.md`**

* Comprehensive terminology reference
* Alphabetically organized
* Linked from quick reference and modules

**`images/`**

* Diagrams, illustrations, and visual aids
* Used across multiple modules
* See `images/README.md` for usage guidelines

**`templates/`**

* Downloadable tools and frameworks
* Reusable across all learning levels
* Both Markdown and JSON formats

---
## Quick Reference (`quick-reference/`)

### Purpose

Provides concise, at-a-glance reference materials for learners who need quick access to key information without reading full modules.

### Target Audience

* Learners needing quick reminders
* Users searching for specific information
* Reference during practical work

### Content Characteristics

* Concise (1-2 pages maximum)
* Bullet-point format where appropriate
* Links to full modules for deeper exploration

---
## Level-Specific Directories

### TEA Trainee (`tea-trainee/`)

**Target:** Newcomers to trustworthy and ethical assurance
**Prerequisites:** None
**Time Commitment:** 6-10 hours total

### TEA Specialist (`tea-specialist/`)

**Target:** Completed TEA Trainee or equivalent experience
**Prerequisites:** Basic assurance case building skills
**Time Commitment:** 15-25 hours total

### TEA Expert (`tea-expert/`)

**Target:** Completed TEA Specialist or significant professional experience
**Prerequisites:** Production-level case development experience
**Time Commitment:** 12-20 hours total

---
## Exercise Directories

Each level includes an `exercises/` subdirectory for:

* Practice exercises
* Assessment materials
* Case study files
* Supporting data/examples

**Naming Convention:** `exercise-NN-descriptive-name.md`

---
## Contributor Guidelines

### Adding New Modules

1. Place module file in appropriate level directory
2. Use consistent number prefix based on sequence
3. Include complete frontmatter
4. Update parent `index.md` to link to new module
5. Update `sidebars.js` in tea-docs root
6. Test all internal links

### Updating Existing Modules

1. Maintain existing number prefix
2. Update `sidebar_label` if title changes significantly
3. Check and update cross-references in other modules
4. Document changes in git commit message

### Adding Shared Resources

1. Place in appropriate `shared/` subdirectory
2. Add entry to glossary if introducing new terms
3. Update images README if adding visuals
4. Link from relevant modules

---
## Migration Notes

### Changes from Previous Structure

**Former:** `skills-resources/`
**Current:** `curriculum/`

**Rationale:** Better reflects the educational focus and structured learning progression

**Key Changes:**

* Directory renamed from `skills-resources` to `curriculum`
* Module files prefixed with numbers (e.g., `first-sip.md` → `01-first-sip.md`)
* Added `shared/` directory for common resources
* Added `quick-reference/` directory for concise guides
* Added `exercises/` subdirectories for each level
* Sidebar category label updated to "TEA Curriculum"

**All internal links updated** as of November 2025.

---
## Maintenance

**Review Frequency:** Quarterly or when structure changes
**Responsibility:** Documentation Team Lead
**Version Control:** Update version number and date when making structural changes

---
## Related Documentation

* **Curriculum Planning:** `tea-docs/TEA-CURRICULUM-PLANNING.md`
* **Development Roadmap:** `tea-docs/TEA-DEVELOPER-ROADMAP.md`
* **Technical Documentation Planning:** `tea-docs/TEA-TECHNICAL-DOCUMENTATION-PLANNING.md`

---
## Questions or Feedback

For questions about the curriculum structure or suggestions for improvements:

* Open an issue on [GitHub](https://github.com/alan-turing-institute/AssurancePlatform/issues)
* Contact the Documentation Team Lead
* Join the TEA Community discussions

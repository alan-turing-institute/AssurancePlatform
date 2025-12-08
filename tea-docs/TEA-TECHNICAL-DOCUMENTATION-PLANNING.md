# TEA Technical Documentation Planning

**Version:** 1.0
**Date:** November 2025
**Purpose:** Technical documentation gaps and specifications

---

## Document Purpose

This document identifies and specifies technical documentation needs for the TEA platform. It focuses on:
- Documentation gaps for developers and advanced users
- Specifications for each type of technical documentation
- Priority levels and dependencies
- Integration with curriculum needs

For curriculum content planning, see `TEA-CURRICULUM-PLANNING.md`.
For implementation timeline, see `TEA-DEVELOPER-ROADMAP.md`.

---

## Table of Contents

1. [Overview of Technical Documentation Needs](#overview-of-technical-documentation-needs)
2. [Critical Priority Documentation](#critical-priority-documentation)
3. [Medium Priority Documentation](#medium-priority-documentation)
4. [Lower Priority Documentation](#lower-priority-documentation)
5. [Documentation Standards & Guidelines](#documentation-standards--guidelines)
6. [Appendix: Current Documentation State](#appendix-current-documentation-state)

---

## Overview of Technical Documentation Needs

### Current State Summary

The TEA platform has:
- ✅ Setup and installation guides (local, Docker, cloud)
- ✅ Basic technical overview
- ✅ Some frontend and backend technology references
- ❌ **NO comprehensive API documentation**
- ❌ **NO developer contributing guide**
- ❌ **NO detailed platform features guide**
- ❌ **NO architecture documentation**
- ❌ **NO integration guides**

### Impact on Curriculum

Several curriculum modules **cannot be developed** without technical documentation:

| Module | Requires | Priority |
|--------|----------|----------|
| Specialist M5 (Integration) | Integration guides, GitHub workflow | HIGH |
| Specialist M6 (Advanced Features) | API reference, JSON schema | CRITICAL |
| Expert M6 (Teaching) | Complete platform docs for teaching | MEDIUM |

---

## Critical Priority Documentation

### 1. Comprehensive API Reference

**Status:** ❌ Does not exist
**Priority:** CRITICAL
**Curriculum Dependency:** Specialist Module 6
**Roadmap Sprint:** 4.1 (Weeks 1-4 of Phase 4)

#### Scope

Document all REST API endpoints currently defined in `tea_backend/api/urls.py`:

**Authentication & Users:**
- `POST /api/auth/login/` - User login
- `GET /api/user/` - Get current user details
- `GET /api/users/` - List users
- `GET /api/users/<id>/` - Get user details
- `POST /api/users/<id>/change-password` - Change password

**Assurance Cases:**
- `GET /api/cases/` - List assurance cases
- `POST /api/cases/` - Create new case
- `GET /api/cases/<id>/` - Get case details
- `PUT /api/cases/<id>/` - Update case
- `DELETE /api/cases/<id>/` - Delete case
- `GET /api/cases/<id>/image` - Get case screenshot
- `GET /api/cases/<id>/sandbox` - Get orphaned elements
- `POST /api/cases/<id>/sharedwith` - Share case
- `POST /api/cases/<id>/update-ids` - Reset identifiers

**Case Elements:**
- Goals: `GET/POST /api/goals/`, `GET/PUT/DELETE /api/goals/<id>/`
- Property Claims: `GET/POST /api/propertyclaims/`, `GET/PUT/DELETE /api/propertyclaims/<id>/`
- Strategies: `GET/POST /api/strategies/`, `GET/PUT/DELETE /api/strategies/<id>/`
- Evidence: `GET/POST /api/evidence/`, `GET/PUT/DELETE /api/evidence/<id>/`
- Context: `GET/POST /api/contexts/`, `GET/PUT/DELETE /api/contexts/<id>/`

**Element Operations:**
- `POST /api/propertyclaims/<id>/attach` - Attach to parent
- `POST /api/propertyclaims/<id>/detach` - Detach from parent
- (Similar attach/detach for strategies, evidence, context)

**Comments:**
- `GET/POST /api/<element>/<id>/comments/` - Element comments
- `GET/PUT/DELETE /api/comments/<id>/` - Comment operations
- `POST /api/comments/<id>/reply/` - Reply to comment

**Groups:**
- `GET/POST /api/groups/` - List and create groups
- `GET/PUT/DELETE /api/groups/<id>/` - Group operations

**GitHub Integration:**
- `POST /api/auth/github/` - GitHub OAuth
- `GET /api/users/<id>/github_repositories/` - User's repos
- `GET/POST /api/github_repositories/` - Repository operations

#### Required Content for Each Endpoint

**Standard Format:**

```markdown
### Endpoint Name

**HTTP Method:** GET/POST/PUT/DELETE
**Path:** `/api/path/<id>/`
**Authentication:** Required (Token-based)

**Description:**
Clear description of what this endpoint does

**Path Parameters:**
- `id` (integer, required): Description

**Query Parameters:**
- `param_name` (type, optional): Description

**Request Headers:**
- `Authorization`: `Token <your_token_here>` (required)
- `Content-Type`: `application/json` (for POST/PUT)

**Request Body:**
```json
{
  "field": "value",
  "nested": {
    "field": "value"
  }
}
```

**Field Descriptions:**
- `field` (string, required): Description
- `nested.field` (string, optional): Description

**Response:**

**Success (200 OK):**
```json
{
  "id": 1,
  "field": "value"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource doesn't exist
- `500 Internal Server Error`: Server error

**Example Request (cURL):**
```bash
curl -X POST \
  https://api.example.com/api/cases/ \
  -H 'Authorization: Token your_token_here' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "My Assurance Case",
    "description": "Testing API"
  }'
```

**Example Request (Python):**
```python
import requests

headers = {
    'Authorization': 'Token your_token_here',
    'Content-Type': 'application/json'
}

data = {
    "name": "My Assurance Case",
    "description": "Testing API"
}

response = requests.post(
    'https://api.example.com/api/cases/',
    headers=headers,
    json=data
)

print(response.json())
```

**Example Request (JavaScript):**
```javascript
fetch('https://api.example.com/api/cases/', {
  method: 'POST',
  headers: {
    'Authorization': 'Token your_token_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'My Assurance Case',
    description: 'Testing API'
  })
})
.then(response => response.json())
.then(data => console.log(data));
```

**Related Endpoints:**
- Link to related endpoints

**Notes:**
- Special considerations
- Permissions required
- Rate limiting (if applicable)
```

#### Additional API Documentation Sections

**Authentication Guide:**
- How to obtain tokens
- Token lifecycle
- Refreshing tokens
- Security best practices

**Error Handling:**
- Standard error format
- Error codes and meanings
- Troubleshooting common errors

**Rate Limiting:**
- Current limits (if any)
- How limits are enforced
- Headers showing limit status

**Pagination:**
- How list endpoints are paginated
- Query parameters for pagination
- Response format for paginated results

**Filtering & Searching:**
- Available query parameters
- Filter syntax
- Examples

#### WebSocket Protocol Documentation

**Real-Time Collaboration:**
- Connection endpoint
- Authentication for WebSocket
- Message formats
- Event types:
  - Element created
  - Element updated
  - Element deleted
  - User joined/left
  - Comment added
- Heartbeat and reconnection
- Error handling

**Example:**

```markdown
### WebSocket Connection

**Endpoint:** `wss://api.example.com/ws/case/<case_id>/`

**Authentication:**
Include token in URL: `wss://api.example.com/ws/case/123/?token=your_token`

**Connection Example (JavaScript):**
```javascript
const socket = new WebSocket(
  'wss://api.example.com/ws/case/123/?token=' + token
);

socket.onopen = () => {
  console.log('Connected');
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

**Message Types:**

**Element Updated:**
```json
{
  "type": "element_updated",
  "element_type": "property_claim",
  "element_id": 45,
  "data": {
    "short_description": "Updated claim"
  },
  "user": {
    "id": 5,
    "username": "alice"
  },
  "timestamp": "2025-11-05T10:30:00Z"
}
```

(Full specification for each message type)
```

#### Suggested Location

`tea_frontend/tea-docs/docs/docs/technical-guide/api-reference/`

Structure:
```
api-reference/
├── index.md                    # Overview and getting started
├── authentication.md           # Auth guide
├── assurance-cases.md          # Case endpoints
├── case-elements.md            # Goals, claims, strategies, evidence, context
├── comments.md                 # Comment endpoints
├── users-and-groups.md         # User and group management
├── websockets.md               # Real-time collaboration
├── errors.md                   # Error handling
└── examples/                   # Full example workflows
    ├── create-complete-case.md
    ├── share-and-collaborate.md
    └── export-and-backup.md
```

#### Estimated Effort

- **40-60 hours** for complete API reference
- Includes: writing, code examples, testing examples
- Can be split across multiple contributors by endpoint group

---

### 2. Platform Features User Guide

**Status:** ❌ Does not exist
**Priority:** CRITICAL
**Curriculum Dependency:** Trainee Module 2
**Roadmap Sprint:** 1.3 (Week 3 of Phase 1) + ongoing

#### Scope

Comprehensive user guide for all platform features, organized by workflow.

**Structure:**

```
user-guide/
├── index.md                    # Overview
├── getting-started/
│   ├── creating-account.md
│   ├── first-login.md
│   └── interface-overview.md
├── building-cases/
│   ├── creating-a-case.md
│   ├── adding-goals.md
│   ├── adding-claims.md
│   ├── adding-strategies.md
│   ├── adding-evidence.md
│   ├── adding-context.md
│   └── linking-elements.md
├── editing-and-managing/
│   ├── editing-elements.md
│   ├── deleting-elements.md
│   ├── the-sandbox.md
│   └── managing-identifiers.md
├── visualization/
│   ├── canvas-navigation.md
│   ├── layout-options.md
│   └── taking-screenshots.md
├── collaboration/
│   ├── sharing-cases.md
│   ├── permissions-explained.md
│   ├── real-time-collaboration.md
│   ├── comments-and-discussions.md
│   └── managing-teams.md
├── import-export/
│   ├── json-export.md
│   ├── json-import.md
│   └── backup-strategies.md
├── publishing/
│   ├── creating-case-studies.md
│   ├── publishing-vs-private.md
│   └── discover-section.md
└── troubleshooting.md
```

#### Content Requirements

Each guide should include:
- Clear step-by-step instructions
- Annotated screenshots
- Common pitfalls and solutions
- Related features
- Video demonstrations (where applicable)

#### Estimated Effort

- **30-40 hours** initial creation
- Ongoing updates as features change

---

### 3. Developer Contributing Guide

**Status:** ❌ Does not exist (no CONTRIBUTING.md)
**Priority:** CRITICAL
**Curriculum Dependency:** Specialist Module 8, Expert Module 7
**Roadmap Sprint:** 4.2 (Weeks 5-7 of Phase 4)

#### Scope

Complete guide for developers who want to contribute to the TEA platform.

**Required Content:**

#### 3.1 Getting Started
- Prerequisites (Node.js, Python versions, etc.)
- Forking and cloning the repository
- Development environment setup
- Running local development servers
- Accessing local instance

#### 3.2 Code Structure
- Repository organization
- Frontend structure (`tea_frontend/`)
  - Next.js app structure
  - Component organization
  - State management (Zustand)
  - React Flow integration
- Backend structure (`tea_backend/`)
  - Django app organization
  - Models, views, serializers
  - URL routing
  - WebSocket consumers
- Testing structure
  - Frontend tests (Jest, React Testing Library)
  - Backend tests (pytest, Django tests)

#### 3.3 Development Workflow
- Creating a feature branch
- Coding standards and style guides
  - Python (PEP 8, Black, isort)
  - TypeScript/JavaScript (ESLint, Prettier)
  - React conventions
- Writing tests
  - When to write tests
  - Test coverage expectations
  - Running tests locally
- Documentation requirements
  - Code comments
  - Docstrings
  - README updates

#### 3.4 Pull Request Process
- PR title and description format
- Checklist before submitting
- Review process
- Addressing feedback
- Merging criteria

#### 3.5 Code Review Guidelines
- What reviewers look for
- How to be a good reviewer
- Response time expectations

#### 3.6 Issue Reporting
- Bug report template
- Feature request template
- Good issue examples

#### 3.7 Community Guidelines
- Code of conduct
- Communication channels (GitHub Discussions, etc.)
- Getting help

**Suggested Location:** `CONTRIBUTING.md` in repository root + linked from docs

**Estimated Effort:** 25-35 hours

---

## Medium Priority Documentation

### 4. JSON Schema Documentation

**Status:** ❌ Not documented
**Priority:** MEDIUM-HIGH
**Curriculum Dependency:** Specialist Module 6
**Roadmap Sprint:** 4.3 (Weeks 8-10 of Phase 4)

#### Scope

Complete documentation of the JSON import/export format for assurance cases.

**Required Content:**

#### 4.1 Schema Overview
- Purpose and use cases
- Version information
- Compatibility notes

#### 4.2 Complete JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "TEA Assurance Case",
  "type": "object",
  "properties": {
    "id": { "type": "integer" },
    "name": { "type": "string" },
    "description": { "type": "string" },
    "created_date": { "type": "string", "format": "date-time" },
    "color_profile": { "type": "string", "default": "default" },
    "goals": {
      "type": "array",
      "items": { "$ref": "#/definitions/Goal" }
    },
    "property_claims": { ... },
    "strategies": { ... },
    "evidence": { ... },
    "contexts": { ... }
  },
  "definitions": {
    "Goal": {
      "type": "object",
      "properties": { ... },
      "required": ["name", "short_description"]
    },
    ...
  }
}
```

#### 4.3 Field Descriptions
- Every field explained
- Required vs. optional
- Data types and formats
- Default values
- Validation rules

#### 4.4 Examples
- Minimal valid case
- Complete complex case
- Common patterns

#### 4.5 Version History
- Schema changes across versions
- Migration guide

**Suggested Location:** `technical-guide/backend-reference/json-schema.md`

**Estimated Effort:** 15-20 hours

---

### 5. Integration Guides

**Status:** ❌ GitHub integration exists but not documented
**Priority:** MEDIUM-HIGH
**Curriculum Dependency:** Specialist Module 5
**Roadmap Sprint:** 4.3 (Weeks 8-10 of Phase 4)

#### 5.1 GitHub Integration Guide

**Content:**
- Setting up GitHub OAuth application
- Linking GitHub account
- Repository access and permissions
- Importing cases from GitHub
- Exporting cases to GitHub
- Webhook integration (if supported)
- Best practices for version control

**Location:** `technical-guide/integrations/github.md`

#### 5.2 CI/CD Integration Patterns

**Content:**
- Using JSON export in CI pipelines
- Automated case validation
- Integration with testing frameworks
- Deployment workflows
- Example GitHub Actions workflow
- Example GitLab CI configuration

**Location:** `technical-guide/integrations/ci-cd.md`

#### 5.3 Version Control Strategies

**Content:**
- Git workflow for assurance cases
- Branching strategies
- Merge conflict resolution
- Tagging and releases
- Team collaboration patterns

**Location:** `technical-guide/integrations/version-control.md`

#### 5.4 MLOps Integration

**Content:**
- Linking assurance cases to ML experiments
- Evidence from ML pipelines
- Model versioning and assurance
- Automated evidence collection

**Location:** `technical-guide/integrations/mlops.md`

**Estimated Effort:** 20-30 hours total (all integration guides)

---

### 6. WebSocket Protocol Documentation

**Status:** ❌ Not documented (implementation exists)
**Priority:** MEDIUM
**Curriculum Dependency:** Trainee Module 4 (basic understanding)
**Roadmap Sprint:** 4.1 (part of API documentation)

#### Scope

Detailed WebSocket protocol for real-time collaboration.

**Content:**
- See WebSocket section in API Reference (#1 above)
- Connection lifecycle
- Message formats
- Event handling
- Reconnection strategies
- Error handling
- Client-side integration examples

**Location:** `technical-guide/api-reference/websockets.md` (part of API docs)

**Estimated Effort:** Included in API documentation effort

---

## Lower Priority Documentation

### 7. Architecture Documentation

**Status:** ❌ Basic tech stack mentioned, no architecture docs
**Priority:** LOW-MEDIUM
**Curriculum Dependency:** None (helpful for Expert level)
**Roadmap Sprint:** 4.4 (Weeks 11-12 of Phase 4)

#### Scope

System architecture and design documentation.

**Required Content:**

#### 7.1 System Architecture
- High-level architecture diagram
- Frontend architecture
- Backend architecture
- Database design
- WebSocket/real-time architecture
- Authentication flow

#### 7.2 Database Schema
- Entity-relationship diagrams
- Table descriptions
- Relationships and constraints
- Indexes and performance considerations

#### 7.3 Frontend Architecture
- Component hierarchy
- State management (Zustand store structure)
- React Flow integration
- Routing structure
- API communication layer

#### 7.4 Backend Architecture
- Django app organization
- Model relationships
- View layer organization
- Serializer patterns
- Permission system

#### 7.5 Data Flow Diagrams
- User authentication flow
- Case creation flow
- Real-time collaboration flow
- Element CRUD operations

**Location:** `technical-guide/architecture/`

**Estimated Effort:** 15-25 hours

---

### 8. Performance and Scaling Guide

**Status:** ❌ Does not exist
**Priority:** LOW
**Curriculum Dependency:** Specialist Module 6 (optimization topics)
**Roadmap Sprint:** 4.4 (part of advanced topics)

#### Scope

Performance optimization and scaling considerations.

**Content:**

#### 8.1 Performance Best Practices
- Handling large assurance cases (100+ elements)
- Optimizing React Flow rendering
- Database query optimization
- API response optimization

#### 8.2 Frontend Performance
- Component memoization
- Lazy loading
- Code splitting
- Bundle optimization

#### 8.3 Backend Performance
- Database indexing strategies
- Query optimization
- Caching strategies
- Batch operations

#### 8.4 Scaling Considerations
- Horizontal vs. vertical scaling
- Database scaling
- WebSocket scaling (multiple servers)
- Load balancing
- CDN usage for static assets

**Location:** `technical-guide/advanced/performance.md`

**Estimated Effort:** 10-15 hours

---

## Documentation Standards & Guidelines

### Writing Style

**Clarity:**
- Use clear, concise language
- Define technical terms on first use
- Provide examples for complex concepts

**Structure:**
- Use consistent heading hierarchy
- Include table of contents for long documents
- Cross-reference related documents

**Code Examples:**
- Provide examples in multiple languages where applicable
- Test all code examples
- Include error handling in examples
- Comment code appropriately

**Accessibility:**
- Use descriptive link text
- Provide alt text for images
- Ensure code blocks have language identifiers for syntax highlighting

### Maintenance

**Version Control:**
- All documentation in Git
- Semantic versioning for major documentation changes
- CHANGELOG for documentation updates

**Review Process:**
- Technical review by developer
- User testing for user-facing docs
- Quarterly review for accuracy

**Update Triggers:**
- Platform feature changes
- API changes (require doc update before merging)
- User feedback and questions
- Bug fixes affecting documented behavior

### Tools and Formats

**Primary Format:** Markdown (.md) for consistency with Docusaurus

**Diagrams:**
- Use Mermaid for diagrams when possible (renders in Markdown)
- Use draw.io for complex architecture diagrams (export as SVG)
- Store source files in `docs/diagrams/`

**Code Examples:**
- Store reusable code examples in `docs/examples/`
- Test examples as part of documentation build
- Provide as downloadable files when appropriate

**API Documentation:**
- Consider OpenAPI/Swagger specification
- Auto-generate from Django REST Framework if possible
- Supplement with manual examples and explanations

---

## Appendix: Current Documentation State

### Existing Documentation (As of Nov 2025)

**Location:** `tea_frontend/tea-docs/docs/docs/`

#### ✅ Available Documentation

**About & Introduction:**
- `about.mdx` - About TEA
- `intro.mdx` - Introduction

**Skills Resources:**
- `skills-resources/tea-trainee/first-sip.md` - Module 1 (complete)
- `skills-resources/standalone/assurance-ecosystem.md` - Complete
- `skills-resources/standalone/standards.md` - Complete

**Technical Guide - Setup:**
- `technical-guide/setup-installation/local-quikstart.md`
- `technical-guide/setup-installation/docker-quikstart.md`
- `technical-guide/setup-installation/cloud-deployment.md`

**Technical Guide - References:**
- `technical-guide/backend-reference/management-files.md`
- `technical-guide/backend-reference/postgres.md`
- `technical-guide/frontend-reference/tailwindcss.md`
- `technical-guide/frontend-reference/nextjs.md`
- `technical-guide/frontend-reference/reactflow.md`
- `technical-guide/frontend-reference/nextauthjs.md`

**Technical Guide - CI/CD:**
- `technical-guide/ci-cd-pipeline/pipeline-overview.md`
- `technical-guide/ci-cd-pipeline/versioning-strategy.md`
- `technical-guide/ci-cd-pipeline/changelog.md`

#### ❌ Missing Critical Documentation

1. ❌ Comprehensive API Reference
2. ❌ User Guide for Platform Features
3. ❌ Developer Contributing Guide (CONTRIBUTING.md)
4. ❌ JSON Schema Documentation
5. ❌ Integration Guides (GitHub, CI/CD, Version Control)
6. ❌ WebSocket Protocol Documentation
7. ❌ Architecture Documentation
8. ❌ Performance and Scaling Guide

---

## Summary and Next Steps

### Priority Matrix

| Documentation | Priority | Curriculum Blocker | Est. Hours |
|---------------|----------|-------------------|-----------|
| API Reference | CRITICAL | Specialist M6 | 40-60 |
| User Guide | CRITICAL | Trainee M2 | 30-40 |
| Contributing Guide | CRITICAL | Specialist M8, Expert M7 | 25-35 |
| JSON Schema | MEDIUM-HIGH | Specialist M6 | 15-20 |
| Integration Guides | MEDIUM-HIGH | Specialist M5 | 20-30 |
| WebSocket Docs | MEDIUM | Trainee M4 | Incl. in API |
| Architecture | LOW-MEDIUM | None | 15-25 |
| Performance | LOW | Specialist M6 (optional) | 10-15 |

**Total Estimated Effort:** 155-225 hours

### Recommended Approach

**Phase 4.1 (Weeks 1-4):** API Reference + WebSocket
- Start immediately (can run parallel with curriculum development)
- Critical for Specialist modules
- **Deliverable:** Complete API documentation

**Phase 4.2 (Weeks 5-7):** Contributing Guide
- Essential for community growth
- Supports Expert-level contribution
- **Deliverable:** CONTRIBUTING.md complete

**Phase 4.3 (Weeks 8-10):** Integration Guides + JSON Schema
- Supports Specialist M5 and M6
- **Deliverable:** Integration documentation suite

**Phase 4.4 (Weeks 11-12):** Architecture + Performance
- Lower priority, advanced topics
- **Deliverable:** Architecture and advanced docs

**Ongoing:** User Guide
- Start with Sprint 1.3 (quick fixes)
- Build out alongside Trainee Module 2 development
- **Deliverable:** Growing user guide library

---

## Document Maintenance

**Owner:** Technical Documentation Lead
**Review Frequency:** Quarterly or when platform changes
**Version History:**
- v1.0 (Nov 2025): Initial technical documentation planning

**Related Documents:**
- `TEA-DEVELOPER-ROADMAP.md` - Implementation timeline
- `TEA-CURRICULUM-PLANNING.md` - Curriculum specifications

---

## Conclusion

Comprehensive technical documentation is essential for:
1. Supporting curriculum development (especially Specialist/Expert levels)
2. Enabling community contributions
3. Reducing support burden through self-service docs
4. Professional platform maturity

By following this plan, the TEA platform will have best-in-class technical documentation that supports developers, advanced users, and curriculum learners.

**Priority: Begin with API documentation in Phase 4.1 immediately.**

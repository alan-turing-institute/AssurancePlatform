# TEA Platform Refactoring Plan

## Project Overview

This document outlines a comprehensive refactoring plan to modernise the TEA (Trustworthy and Ethical Assurance) Platform infrastructure, naming conventions, and deployment pipeline.

## Goals and Objectives

1. **Rebrand from EAP to TEA** - Update all references from "Ethical Assurance Platform" (e.g. `eap_backend`) to "Trustworthy and Ethical Assurance"
2. **Modernise CI/CD Pipeline** - Migrate from Docker Hub to GitHub Container Registry (ghcr.io)
3. **Implement Semantic Versioning** - Add proper versioning with automated releases
4. **Standardise Naming Conventions** - Create consistent naming across the entire codebase
5. **Improve deployment reliability and speed** enhance security through GitHub-managed authentication, and create better traceability through semantic versioning

## Current State Analysis

### Directory Structure
```
AssurancePlatform/
├── eap_backend/           # Django REST API
├── next_frontend/         # Next.js frontend
├── .github/workflows/     # CI/CD pipelines
└── docker-compose.*.yml   # Container orchestration
```

### Current Naming Patterns
- **Repositories**: `eap_backend`, `next_frontend`
- **Docker Images**: `turingassuranceplatform/eap_backend`, `turingassuranceplatform/eap_frontend`
- **Azure Resources**: `eap-backend`, `assuranceplatform`
- **Environment Variables**: Mixed conventions (`API_URL`, `NEXTAUTH_SECRET`, etc.)

### Current CI/CD Pipeline
- **Registry**: Docker Hub (`turingassuranceplatform/`)
- **Authentication**: Manual secrets (`DOCKER_HUB_USERNAME`, `DOCKER_HUB_TOKEN`)
- **Versioning**: Date-based (`YYYY-MM-DD.sha-short`) + branch tags
- **Deployment**: Azure App Service with continuous deployment

## Proposed Changes

### 1. Naming Convention Standards

#### Directory Names
- `eap_backend/` → `tea_backend/`
- `next_frontend/` → `tea_frontend/`

#### Docker Image Names
- `turingassuranceplatform/eap_backend` → `ghcr.io/alan-turing-institute/tea-platform/backend`
- `turingassuranceplatform/eap_frontend` → `ghcr.io/alan-turing-institute/tea-platform/frontend`

#### Azure Resource Names
- Keep existing Azure resources to avoid deployment disruption
- Update container image references only
- Azure resource renaming requires IT team involvement (out of scope)

#### Environment Variables
- Standardize to `SCREAMING_SNAKE_CASE`
- Prefix platform-specific variables with `TEA_`

### 2. Container Registry Migration

#### Target Registry
- **From**: Docker Hub (`docker.io`)
- **To**: GitHub Container Registry (`ghcr.io`)

#### Benefits
- Free for public repositories
- Native GitHub integration
- Automatic authentication via `GITHUB_TOKEN`
- Better security and access control

### 3. Semantic Versioning Strategy

#### Version Format
- **Production**: `v1.2.3` (standard semantic versioning)
- **Staging**: `v1.2.3-dev.20250112.abc123` (pre-release format)
- **Feature Branches**: `v1.2.3-feature-xyz.abc123`

#### Release Automation
- Automatic GitHub releases on main branch merges
- Generated release notes from commit messages
- Tagged Docker images with semantic versions

## Task Breakdown

### Phase 1: Planning and Preparation (2-3 days)
- [ ] **TASK-001**: Complete this planning document
- [ ] **TASK-002**: Create backup strategy and rollback procedures
- [ ] **TASK-003**: Set up testing environment
- [ ] **TASK-004**: Document current system dependencies

### Phase 2: Directory and Code Refactoring (3-5 days)
- [ ] **TASK-005**: Rename `eap_backend/` to `tea_backend/`
- [ ] **TASK-006**: Rename `next_frontend/` to `tea_frontend/`
- [ ] **TASK-007**: Update all internal imports and references
- [ ] **TASK-008**: Update Docker compose files
- [ ] **TASK-009**: Update README and documentation
- [ ] **TASK-010**: Test local development environment

### Phase 3: CI/CD Pipeline Migration
- [ ] **TASK-011**: Create new GitHub Actions workflows for ghcr.io
- [ ] **TASK-012**: Implement semantic versioning logic
- [ ] **TASK-013**: Test staging deployment with new pipeline
- [ ] **TASK-014**: Update Azure App Service container configurations
- [ ] **TASK-015**: Verify continuous deployment functionality

### Phase 4: Production Deployment (1-2 days)
- [ ] **TASK-016**: Deploy to production with new naming and versioning
- [ ] **TASK-017**: Verify production functionality
- [ ] **TASK-018**: Clean up old Docker Hub images (optional)
- [ ] **TASK-019**: Update monitoring and alerting configurations

### Phase 5: Documentation and Cleanup (1 day)
- [ ] **TASK-020**: Update CLAUDE.md with new conventions
- [ ] **TASK-021**: Update deployment documentation
- [ ] **TASK-022**: Create migration guide for future reference
- [ ] **TASK-023**: Archive old workflows and configurations

## Acceptance Criteria

### Technical Criteria
- [ ] All directory names follow new TEA conventions
- [ ] All Docker images hosted on ghcr.io
- [ ] Semantic versioning implemented with automated releases
- [ ] CI/CD pipeline uses GitHub authentication only
- [ ] Local development environment works with new structure
- [ ] Staging environment deploys successfully
- [ ] Production environment deploys successfully
- [ ] All existing functionality preserved

### Quality Criteria
- [ ] No broken imports or references
- [ ] All tests pass (backend and frontend)
- [ ] Build pipeline completes without errors
- [ ] Documentation updated and accurate
- [ ] Rollback procedure tested and documented

### Business Criteria
- [ ] Zero downtime deployment
- [ ] No loss of data or functionality
- [ ] Improved deployment reliability
- [ ] Reduced external dependencies
- [ ] Enhanced security posture

## Risk Assessment and Mitigation

### High Risk Items
1. **Directory Renaming Impact**
   - **Risk**: Breaking imports and build processes
   - **Mitigation**: Comprehensive search and replace, thorough testing

2. **Azure Deployment Disruption**
   - **Risk**: Service downtime during container image transition
   - **Mitigation**: Blue-green deployment strategy, quick rollback plan

3. **Authentication Issues**
   - **Risk**: GitHub Container Registry authentication failures
   - **Mitigation**: Test in staging first, maintain Docker Hub as backup

### Medium Risk Items
1. **Local Development Environment**
   - **Risk**: Developer workflow disruption
   - **Mitigation**: Update documentation, provide migration guide

2. **CI/CD Pipeline Complexity**
   - **Risk**: More complex workflow configurations
   - **Mitigation**: Incremental implementation, thorough testing

## Testing Strategy

### Pre-Migration Testing
- [ ] Full backup of current system
- [ ] Test rollback procedures
- [ ] Verify all current functionality works

### During Migration Testing
- [ ] Test each phase independently
- [ ] Verify staging environment after each change
- [ ] Continuous integration testing

### Post-Migration Testing
- [ ] Full end-to-end testing
- [ ] Performance regression testing
- [ ] Security vulnerability scanning
- [ ] User acceptance testing

## Rollback Plan

### Immediate Rollback (< 1 hour)
1. Revert Azure App Service container configurations
2. Switch back to previous Docker Hub images
3. Restore previous GitHub Actions workflows

### Full Rollback (< 4 hours)
1. Revert all directory name changes
2. Restore all code references
3. Rebuild and redeploy from previous state
4. Verify full system functionality


## Success Metrics

### Performance Metrics
- Build time improvement: Target 10-20% faster
- Deployment time: Target sub-5 minute deployments
- Image pull time: Target 50% improvement with ghcr.io

### Operational Metrics
- Zero unplanned downtime
- 100% test pass rate maintained
- Documentation coverage at 100%
- Developer onboarding time reduced

## Next Steps

1. **Review and Approve Plan** - Stakeholder sign-off on this document
2. **Set Up Development Branch** - Create feature branch for refactoring work
3. **Begin Phase 1** - Start with backup and preparation tasks
4. **Regular Check-ins** - Daily progress reviews during implementation

---

**Document Version**: 1.0
**Created**: 2025-01-12
**Last Updated**: 2025-01-12
**Status**: Ready

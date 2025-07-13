---
sidebar_position: 1
---

# CI/CD Pipeline Overview

The TEA Platform CI/CD pipeline follows a GitOps approach with multiple quality gates and automated deployments to staging and production environments.

```mermaid
graph TB
    %% Developer workflow
    Dev[Developer] -->|Code changes| LocalDev[Local Development]
    LocalDev -->|git add| PreCommit{Pre-commit Hooks}

    %% Pre-commit checks
    PreCommit -->|Python| RuffLint[Ruff Linting]
    PreCommit -->|Python| RuffFormat[Ruff Formatting]
    PreCommit -->|Python| MyPy[MyPy Type Check]
    PreCommit -->|Frontend| Prettier[Prettier Formatting]
    PreCommit -->|All| FileChecks[File Checks]

    RuffLint --> CommitReady
    RuffFormat --> CommitReady
    MyPy --> CommitReady
    Prettier --> CommitReady
    FileChecks --> CommitReady

    CommitReady{All Checks Pass?} -->|Yes| LocalCommit[Local Commit]
    CommitReady -->|No| FixIssues[Fix Issues]
    FixIssues --> LocalDev

    %% Git workflow
    LocalCommit -->|Merge locally| StagingBranch[Staging Branch]
    StagingBranch -->|git push| RemoteRepo[(GitHub Repository)]

    %% GitHub Actions
    RemoteRepo --> BranchProtection{Branch Protection}
    BranchProtection -->|Block direct push to main| PRRequired[Pull Request Required]
    BranchProtection -->|Trigger| GitHubActions[GitHub Actions]

    %% Parallel CI checks
    GitHubActions --> BackendCI[Backend CI]
    GitHubActions --> FrontendCI[Frontend CI]

    %% Backend pipeline
    BackendCI --> BackendLint[Ruff + MyPy]
    BackendLint --> BackendBuild[Build Backend Image]
    BackendBuild --> BackendTests[Unit Tests in Container]
    BackendTests --> BackendCoverage{Coverage ≥ 90%?}
    BackendCoverage -->|Yes| BackendIntegration[Integration Tests]
    BackendCoverage -->|No| BuildFails[Build Fails ❌]

    %% Frontend pipeline
    FrontendCI --> FrontendLint[ESLint + Type Check]
    FrontendLint --> FrontendBuild[Build Frontend Image]
    FrontendBuild --> FrontendTests[Unit Tests in Container]
    FrontendTests --> FrontendCoverage{Coverage ≥ 90%?}
    FrontendCoverage -->|Yes| FrontendIntegration[Integration Tests]
    FrontendCoverage -->|No| BuildFails

    %% Integration and release
    BackendIntegration --> E2ETests[E2E Tests]
    FrontendIntegration --> E2ETests
    E2ETests --> AllTestsPass{All Tests Pass?}
    AllTestsPass -->|Yes| PushRegistry[Push to ghcr.io]
    AllTestsPass -->|No| BuildFails

    %% Deployment
    PushRegistry --> TaggedRelease[Tagged Release]
    TaggedRelease --> DeployStaging[Deploy to Azure Staging]
    DeployStaging --> QATesting[QA Testing]
    QATesting --> QAApproval{QA Approved?}
    QAApproval -->|Yes| DeployProd[Deploy to Production]
    QAApproval -->|No| FixBugs[Fix Issues]
    FixBugs --> Dev

    %% Monitoring
    DeployProd --> Monitor[Production Monitoring]
    Monitor --> Alerts[Alerts & Rollback]

    %% Styling
    classDef process fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    classDef decision fill:#F39C12,stroke:#D68910,stroke-width:2px,color:#fff
    classDef storage fill:#27AE60,stroke:#1E8449,stroke-width:2px,color:#fff
    classDef fail fill:#E74C3C,stroke:#C0392B,stroke-width:2px,color:#fff
    classDef success fill:#2ECC71,stroke:#27AE60,stroke-width:2px,color:#fff

    class Dev,LocalDev,LocalCommit,StagingBranch,GitHubActions,BackendCI,FrontendCI process
    class PreCommit,CommitReady,BranchProtection,BackendCoverage,FrontendCoverage,AllTestsPass,QAApproval decision
    class RemoteRepo,PushRegistry storage
    class BuildFails fail
    class DeployProd,Monitor success
```

## Pipeline Stages

### 1. Local Development & Pre-commit

Before code reaches the repository, local quality checks ensure standards are met:

- **Python**: Ruff (linting) and MyPy (type checking)
- **Frontend**: Prettier (formatting), ESLint (linting), TypeScript checks
- **General**: File size limits, merge conflict markers, trailing whitespace

### 2. Branch Strategy

- **Feature branches**: Individual developer work
- **Staging branch**: Integration and testing
- **Main branch**: Production-ready code (protected)

### 3. Continuous Integration

GitHub Actions workflows run on every push:

#### Backend Pipeline
1. **Code Quality**: Ruff and MyPy checks
2. **Docker Build**: Multi-platform image creation
3. **Unit Tests**: PyTest with 90% coverage requirement
4. **Integration Tests**: API and database tests

#### Frontend Pipeline
1. **Code Quality**: ESLint, TypeScript checks
2. **Docker Build**: Next.js production build
3. **Unit Tests**: Component and hook tests (90% coverage)
4. **Integration Tests**: Page and API route tests

### 4. End-to-End Testing

After both backend and frontend pass their individual tests:
- Playwright/Cypress tests for critical user journeys
- Performance benchmarks
- Security scanning

### 5. Container Registry

Successful builds are pushed to GitHub Container Registry (ghcr.io):
- Tagged with semantic version
- Multi-platform support (amd64, arm64)
- Cached for faster builds

### 6. Deployment

#### Staging Environment
- Automated deployment on successful builds
- Full environment matching production
- Used for QA and stakeholder review

#### Production Environment
- Requires manual approval after QA
- Blue-green deployment strategy
- Automatic rollback on errors

## Quality Gates

Each stage acts as a quality gate:

1. **Pre-commit**: Catches issues before commit
2. **Branch Protection**: Prevents direct pushes to main
3. **CI Checks**: Must pass linting and formatting
4. **Test Coverage**: Minimum 90% coverage required
5. **Integration Tests**: All API endpoints tested
6. **E2E Tests**: Critical paths verified
7. **QA Approval**: Human verification in staging

## Tools & Technologies

- **Version Control**: Git, GitHub
- **CI/CD**: GitHub Actions
- **Container Registry**: GitHub Container Registry (ghcr.io)
- **Testing**: PyTest (backend), Jest/Vitest (frontend), Playwright (E2E)
- **Code Quality**: Ruff, MyPy, ESLint, Prettier
- **Deployment**: Docker, Azure App Service
- **Monitoring**: Azure Application Insights

## Environment Variables

The pipeline manages environment-specific configurations:

- **Development**: Local `.env.local` files
- **CI/CD**: GitHub Secrets
- **Staging/Production**: Azure App Service settings

## Security Considerations

- Secrets never committed to repository
- Environment variables injected at build/runtime
- Container images scanned for vulnerabilities
- SAST/DAST tools in pipeline
- Least-privilege access for deployments

## Rollback Strategy

In case of issues:

1. **Automatic**: Health checks trigger auto-rollback
2. **Manual**: Previous versions available in registry
3. **Database**: Migration rollback scripts maintained
4. **Feature Flags**: Gradual rollout capabilities

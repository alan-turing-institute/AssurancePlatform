# Future CI/CD Workflows

This directory contains the complete CI/CD workflows with quality gates that will replace the minimal build-only workflows once the codebase quality issues are resolved.

## Migration Plan

### Current State (Minimal Workflows)
- `backend-build.yaml` - Build and push backend Docker images only
- `frontend-build.yaml` - Build and push frontend Docker images only

### Future State (Full CI/CD)
- `backend-ci-cd.yaml` - Quality checks → Integration tests → Build
- `frontend-ci-cd.yaml` - Quality checks → Build

## When to Migrate

Move these workflows to the main `.github/workflows/` directory when:

1. Backend tests are passing
2. Frontend tests are passing
3. Type checking issues are resolved
4. Linting issues are fixed

## Migration Steps

```bash
# Remove minimal workflows
rm .github/workflows/backend-build.yaml
rm .github/workflows/frontend-build.yaml

# Move full CI/CD workflows
mv .github/workflows-future/backend-ci-cd.yaml .github/workflows/
mv .github/workflows-future/frontend-ci-cd.yaml .github/workflows/

# Remove this directory
rm -rf .github/workflows-future/
```

## Key Differences

### Quality Gates
- Type checking (mypy for backend, TypeScript for frontend)
- Linting (ruff for backend, Ultracite/Biome for frontend)
- Unit tests with coverage requirements
- Integration tests for backend

### Job Dependencies
- Build jobs only run after quality checks pass
- Proper CI/CD pipeline with fail-fast behaviour

### Coverage Reporting
- Codecov integration
- Coverage threshold enforcement

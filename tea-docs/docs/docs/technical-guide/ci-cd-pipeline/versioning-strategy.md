# Versioning and Release Strategy

The TEA Platform uses semantic versioning to provide clear, predictable version numbers that communicate the nature of changes between releases.

## Semantic Versioning Overview

We follow [Semantic Versioning 2.0.0](https://semver.org/) principles using the format **MAJOR.MINOR.PATCH**:

### Version Components

- **MAJOR** (`v1.0.0` → `v2.0.0`)
  - Breaking changes that are not backwards compatible
  - API changes that require user code updates
  - Major architectural changes

- **MINOR** (`v1.0.0` → `v1.1.0`)
  - New features that are backwards compatible
  - New API endpoints or functionality
  - Significant enhancements

- **PATCH** (`v1.0.0` → `v1.0.1`)
  - Backwards compatible bug fixes
  - Security patches
  - Minor improvements

### Pre-Release Versions

During development, we use pre-release identifiers:

- **Development builds**: `v0.2.0-dev.20250112.abc123`
- **Alpha releases**: `v1.0.0-alpha.1`
- **Beta releases**: `v1.0.0-beta.2`
- **Release candidates**: `v1.0.0-rc.1`

## Current Version Strategy

### Version 0.x (Research Preview)

The TEA Platform is currently in research preview with version **v0.2.0**.

- **Version 0.x.y** indicates initial development
- Breaking changes may occur at any time
- APIs and features are subject to change
- Suitable for research, testing, and evaluation

### When We'll Reach v1.0.0

Version 1.0.0 will be released when:
- Core functionality is stable and well-tested
- API interfaces are finalized
- Platform is ready for production use
- Documentation is comprehensive
- Security has been thoroughly reviewed

## Branch Strategy

### Main Branches

- **`main`** - Production releases (e.g., `v0.2.0`)
- **`develop`** - Development builds (e.g., `v0.2.0-dev.20250112.abc123`)

### Version Tagging

#### Production Releases
```bash
# Tagged on main branch
v0.2.0
v0.2.1
v0.3.0
```

#### Development Builds
```bash
# Tagged on develop branch
v0.2.0-dev.20250112.abc123
v0.2.0-dev.20250113.def456
```

## Container Image Tagging

Our Docker images follow the same versioning strategy:

### GitHub Container Registry

- **Production**: `ghcr.io/alan-turing-institute/tea-platform/backend:v0.2.0`
- **Development**: `ghcr.io/alan-turing-institute/tea-platform/backend:v0.2.0-dev.20250112.abc123`
- **Latest**: `ghcr.io/alan-turing-institute/tea-platform/backend:latest`

### Branch Aliases

- **`latest`** - Points to the most recent production release
- **`develop`** - Points to the most recent development build
- **`main`** - Points to the most recent production release (same as latest)

## Release Process

### Automatic Releases

Releases are automatically created through our CI/CD pipeline:

1. **Code merged to `main`** triggers production release
2. **GitHub Actions** builds and tags container images
3. **GitHub Release** created with auto-generated release notes
4. **Deployment** to production environment

### Development Releases

1. **Code pushed to `develop`** triggers development build
2. **Pre-release version** generated automatically
3. **Container images** tagged and pushed
4. **Deployment** to staging environment

### Manual Release Creation

For special releases, maintainers can:

```bash
# Create and push a tag
git tag -a v0.3.0 -m "Release v0.3.0"
git push origin v0.3.0

# Create GitHub release
gh release create v0.3.0 --generate-notes --title "Release v0.3.0"
```

## Release Notes

Release notes are automatically generated from commit messages using GitHub's auto-generation feature. To ensure quality release notes:

### Commit Message Guidelines

- Use conventional commits format where possible
- Include clear, descriptive commit messages
- Reference issue numbers when applicable

### Example Commit Messages

```bash
feat: add user authentication system (#123)
fix: resolve memory leak in data processing (#124)
docs: update API documentation for v0.2.0
chore: update dependencies to latest versions
```

## Version Management

### Package.json Synchronization

Frontend package.json versions are synchronized with Git tags:

```json
{
  "name": "tea-frontend",
  "version": "0.2.0"
}
```

### Environment Variables

Version information is available in the application:

- `NEXT_PUBLIC_APP_VERSION` - Current application version
- `REACT_APP_BUILD_DATE` - Build timestamp
- `REACT_APP_COMMIT_SHA` - Git commit hash

## Deployment Strategy

### Environments

- **Production** (`main` branch)
  - Uses stable version tags (e.g., `v0.2.0`)
  - Deployed to production Azure App Services
  - Available at production URLs

- **Staging** (`develop` branch)
  - Uses development version tags (e.g., `v0.2.0-dev.20250112.abc123`)
  - Deployed to staging Azure App Services
  - Available at staging URLs

### Rollback Strategy

If issues are discovered:

1. **Quick rollback** - Redeploy previous stable version
2. **Container rollback** - Use previous container image tag
3. **Git rollback** - Revert commits and redeploy

## Migration Guidelines

### For Developers

When version changes affect development:

1. Check release notes for breaking changes
2. Update local environment if needed
3. Review API changes and update code
4. Test thoroughly before committing

### For Users

Version changes are communicated through:

- [GitHub releases](https://github.com/alan-turing-institute/AssurancePlatform/releases) with detailed notes
- [Changelog](./changelog.mdx) with comprehensive version history
- Platform notifications (when available)
- Documentation updates
- Community announcements

## Tools and Automation

### GitHub Actions

Our CI/CD pipeline automatically handles:
- Version calculation and tagging
- Container image building and tagging
- Release creation and note generation
- Deployment to appropriate environments

### Version Checking

Check current version:

```bash
# Backend API
curl https://tea-backend.azurewebsites.net/api/version

# Frontend
# Version displayed in application footer
```

## Best Practices

### For Contributors

1. **Follow semantic versioning principles** when proposing changes
2. **Write clear commit messages** for better release notes
3. **Test thoroughly** before merging to main
4. **Document breaking changes** clearly

### For Maintainers

1. **Review version impact** before merging PRs
2. **Coordinate major releases** with stakeholders
3. **Maintain changelog** for significant releases
4. **Communicate changes** clearly to users

---

For questions about versioning strategy, please refer to the [Technical Documentation](../index.md) or reach out through our [Community Support](../../community/community-support.md) channels.

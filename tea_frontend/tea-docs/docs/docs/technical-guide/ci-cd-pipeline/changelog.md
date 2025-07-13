---
sidebar_position: 3
title: "Changelog"
description: "Complete version history and release notes for the TEA Platform"
---

# Changelog

All notable changes to the TEA Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- TEA Platform refactoring plan for modernising infrastructure
- Comprehensive versioning and release strategy documentation
- GitHub Container Registry migration strategy

### Changed
- Planning migration from Docker Hub to GitHub Container Registry (ghcr.io)
- Directory naming conventions from EAP to TEA branding

## [0.2.0] - TBD

### Added
- Semantic versioning implementation
- Automated release process via GitHub Actions
- Container image tagging with semantic versions

### Changed
- Updated from EAP (Ethical Assurance Platform) to TEA (Trustworthy and Ethical Assurance) branding
- Migrated container registry from Docker Hub to GitHub Container Registry

### Technical
- Directory structure: `eap_backend/` → `tea_backend/`, `next_frontend/` → `tea_frontend/`
- Container images: `turingassuranceplatform/eap_*` → `ghcr.io/alan-turing-institute/tea-platform/*`
- Improved CI/CD pipeline with GitHub-managed authentication

## [0.1.0] - Historical

### Added
- Initial TEA Platform release
- Django backend with REST API
- Next.js frontend with ReactFlow integration
- Basic Docker containerization
- Azure App Service deployment
- PostgreSQL database support
- GitHub OAuth authentication

### Technical
- Django 5.1.11 backend
- Next.js 15 frontend with React 19
- Docker Hub container hosting
- Azure App Service hosting
- Basic CI/CD pipeline

---

## Release Types

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes
- **Technical** for infrastructure and development changes
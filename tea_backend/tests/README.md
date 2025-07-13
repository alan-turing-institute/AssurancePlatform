# TEA Platform Backend Tests

This directory contains comprehensive tests for the TEA Platform backend, implementing a modern testing architecture with 90%+ coverage requirements.

## Architecture

### Testing Stack
- **pytest-django**: Modern test runner with Django integration
- **FactoryBoy**: Dynamic test data generation
- **PostgreSQL**: Production parity database testing
- **coverage.py**: Coverage reporting with 90% threshold

### Directory Structure
```
tests/
├── conftest.py                    # Pytest configuration and fixtures
├── factories/                     # FactoryBoy test data factories
│   ├── base.py                   # Base factory classes
│   ├── user_factories.py         # User and authentication factories
│   ├── case_factories.py         # Assurance case factories
│   └── content_factories.py      # Content model factories
├── models/                        # Model tests
│   ├── test_user_models.py       # User and group model tests
│   ├── test_case_models.py       # Assurance case model tests
│   └── test_content_models.py    # Content model tests
├── views/                         # API endpoint tests
├── serializers/                   # Serializer tests
├── utils/                         # Utility function tests
├── permissions/                   # Permission system tests
├── websockets/                    # WebSocket consumer tests
└── integration/                   # Integration tests
```

## Running Tests

### Local Development (PostgreSQL via Docker)
```bash
# Start PostgreSQL
docker-compose -f docker-compose.development.yml up postgres -d

# Run all tests
uv run pytest

# Run with coverage
uv run coverage run -m pytest
uv run coverage report

# Run specific test file
uv run pytest tests/models/test_user_models.py
```

### CI/CD Environment
Tests run automatically in GitHub Actions with PostgreSQL container services.

## Test Conventions

### Naming
- Test files: `test_*.py`
- Test classes: `Test*`
- Test methods: `test_should_[expected_behavior]_when_[condition]`
- Factories: `[Model]Factory`

### Organization
- One test file per model/view/serializer
- Group related tests in classes
- Use descriptive test method names
- Include docstrings for complex test scenarios

### Data Creation
- Use factories for test data (avoid hardcoded values)
- Create minimal data needed for each test
- Use `@pytest.mark.django_db` for database tests

## Coverage Requirements

- **Minimum**: 90% line coverage
- **Target**: 95%+ line coverage
- **Branch coverage**: 85%+ recommended

Coverage is enforced in CI/CD and will fail builds below 90%.

## Database Testing

### PostgreSQL Everywhere
- Local development: PostgreSQL via Docker Compose
- CI/CD: PostgreSQL container services
- Production parity for all environments

### Test Database Configuration
```python
# Configured in conftest.py
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "test_tea_platform",
        # ... other settings
    }
}
```

## Performance Targets

- **Unit tests**: < 2 minutes (including container startup)
- **Integration tests**: < 5 minutes
- **Full test suite**: < 10 minutes in CI/CD

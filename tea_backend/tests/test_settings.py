"""
Test-specific Django settings that override production settings for testing.

This file ensures tests use local file storage instead of Azure Storage
to avoid authentication issues during testing.
"""

from tea_backend.settings import *

# Override storage settings for testing
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

# Use local media settings for tests
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "test_media"

# Ensure we're using local storage for all file fields
DEFAULT_FILE_STORAGE = "django.core.files.storage.FileSystemStorage"

"""Django's command-line utility for administrative tasks."""

import os
import sys

from django.core.management import execute_from_command_line


def main():
    """Run administrative tasks."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "tea_backend.settings")
    try:
        execute_from_command_line(sys.argv)
    except ImportError as exc:
        msg = "Couldn't import Django. Are you sure it's installed and available on your PYTHONPATH environment variable? Did you forget to activate a virtual environment?"
        raise ImportError(msg) from exc


if __name__ == "__main__":
    main()

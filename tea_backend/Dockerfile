FROM nikolaik/python-nodejs:python3.12-nodejs22

# Install uv
RUN pip install uv

COPY . /app
WORKDIR /app

# Install dependencies with uv from pyproject.toml
RUN uv pip install --system .

# Run tests with coverage during build
RUN python manage.py test -v 2
RUN uv run coverage run manage.py test -v 2
RUN uv run coverage report --fail-under=90 --show-missing

# Setup for production
RUN python manage.py createadmin
RUN python manage.py migrate
CMD python manage.py migrate && daphne -b 0.0.0.0 -p 8000 tea_backend.asgi:application

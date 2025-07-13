FROM nikolaik/python-nodejs:python3.12-nodejs22

# Install uv
RUN pip install uv

COPY . /app
WORKDIR /app

# Install dependencies with uv from pyproject.toml
RUN uv pip install --system .

RUN python manage.py createadmin
RUN python manage.py migrate
CMD python manage.py migrate && uvicorn --host 0.0.0.0 tea_backend.asgi:application

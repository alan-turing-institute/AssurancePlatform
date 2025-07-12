FROM nikolaik/python-nodejs:python3.12-nodejs22
COPY . /app
WORKDIR /app
RUN pip install -r requirements.txt
RUN python manage.py createadmin
RUN python manage.py migrate
CMD python manage.py migrate && uvicorn --host 0.0.0.0 tea_backend.asgi:application

FROM python:3
COPY . /eap_backend
WORKDIR /eap_backend
RUN pip install -r requirements.txt
RUN python manage.py migrate
ENTRYPOINT ["python", "manage.py", "runserver", "0.0.0.0:8000"]

FROM python:3
COPY . /eap_backend
WORKDIR /eap_backend
RUN pip install -r requirements.txt
ENV DBHOST=MY_DB_HOSTNAME
ENV DBNAME=MY_DB_DATABASE_NAME
ENV DBUSER=MY_DB_USERNAME
ENV DBPASSWORD=MY_DB_PASSWORD
RUN python manage.py migrate
ENTRYPOINT ["python", "manage.py", "runserver", "0.0.0.0:8000"]
# How to run the EAP backend

The backend is written in the "Django" framework.  
To run using an sqlite database (e.g. for testing/development), just run the command:
```
python manage.py runserver
```
from this directory.

To use e.g. a postgres database, set the environment variables `DBHOST`, `DBNAME`, `DBUSER` and `DBPASSWORD` before running that command.

## Running tests

```
python manage.py test
```

### Settings

Most useful settings are in the file `eap_backend/settings.py`.

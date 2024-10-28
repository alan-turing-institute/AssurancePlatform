# Setup the Backend environment

To set up an environment for a Django project, follow these general steps:

### Prerequisites
- Please ensure that you have Python version 3.10 installed on your machine

---

### Get Started

- Clone the Repository:

```bash
git clone https://github.com/alan-turing-institute/AssurancePlatform.git
cd AssurancePlatform/eap_backend
```

- Set Up a Virtual Environment:

```bash
python3 -m venv env
source env/bin/activate  # Or `env\Scripts\activate` on Windows
```

- Install Dependencies: Ensure requirements are defined in requirements.txt. Install them with:

```bash
pip install -r requirements.txt
```

- Configure the Database: Update settings.py with your database configurations if needed, typically under DATABASES. For testing, SQLite (default in Django) works well.

- Apply Migrations:

```bash
python manage.py migrate
```

- Run the Development Server:

```bash
python manage.py runserver
```

> **Note**: You may need to replace `python` with your installed version for example `python3.10`

Access the server locally at http://127.0.0.1:8000.
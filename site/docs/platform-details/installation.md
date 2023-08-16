# Installation Instructions

!!! info "Live Demo"

    A demo version of the assurance platform is available at [https://assuranceplatform.azurewebsites.net/](https://assuranceplatform.azurewebsites.net/).
    Please note that all data is removed on a regular basis.

To run the platform locally, please follow these instructions according to your
preferred setup:

## Docker Install

!!! warning "Knowledge of Docker"

    The following instructions assume prior knowledge of Docker and docker-compose.

- Clone the
  [Assurance Platform repository](https://github.com/alan-turing-institute/AssurancePlatform)
  to your local machine.

```shell
git clone https://github.com/alan-turing-institute/AssurancePlatform.git
```

- Change into the `AssurancePlatform` directory.

```shell
cd AssurancePlatform/
```

- Pull images and deploy container

```shell
docker compose pull && docker compose up
```

- At this point, you can open the site in your browser:
  [http://localhost:3000](http://localhost:3000)
- When you would like to stop, open a new terminal, navigate to the
  `AssurancePlatform` directory, and run `docker compose down`.

## Local Install

!!! warning "Knowledge of Virtual Environments"

    The following instructions assume prior knowledge of virtual environment managers for Python, such as conda or venv.
    We give commands using conda in the following steps.

- Download or clone the AssurancePlatform repository to your local machine.

```shell
git clone https://github.com/alan-turing-institute/AssurancePlatform.git
```

### Set up and run the backend

- Install Python version 3.8 or higher.
- Create a new Python environment

```shell
conda create --name eapenv python=3.8 -y
```

- Activate your new virtual environment

```shell
conda activate eapenv
```

- Change into the `eap_backend` directory.

```shell
cd eap_backend
```

- Install the requirements from the requirements.txt file

```shell
pip install -r requirements.txt
```

- Set up the database (this will create a local SQLite file by default):

```shell
python manage.py migrate
```

- Run the Django tests:

```shell
python manage.py test
```

- Run the API (NB: by default, the API will use port 8000 on localhost)

```shell
python manage.py runserver
```

- To be able to export SVG images from the frontend, you will need to install
  the following (`npm` instructions are part of the front end setup below):

```shell
npm install -g @mermaid-js/mermaid-cli
```

- At this point, the backend is ready and needs to be connected to the frontend.

### Setup and run the frontend

- Install [npm](https://www.npmjs.com/)

  - For Debian or Ubuntu-based Linux,
    `sudo apt install nodejs; sudo apt install npm`
  - For CentOS or Fedora-based Linux, `sudo yum install nodejs npm`
  - For OSX using Homebrew, `brew install npm`
  - For Windows, download and install from the official website.

- Open a new terminal while the backend is running and navigate to the frontend
  folder:

```shell
cd frontend
```

- Install npm dependencies:

```shell
npm install
```

- Run the react tests:

```shell
npm run test
```

- Run the development server:

```shell
npm start
```

- This will launch a browser tab pointing to the web app at
  `http://localhost:3000`.

- If you get an SSL error, run the following commands and try again:

```shell
npm update
npm audit fix --force
npm i react-scripts@latest
```

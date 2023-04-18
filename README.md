# SAFE-D Assurance Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)[![Build Status](https://app.travis-ci.com/alan-turing-institute/AssurancePlatform.svg?branch=MVP)](https://app.travis-ci.com/alan-turing-institute/AssurancePlatform)

![A stylised illustration of a project team building an assurance case](hero.png)

## About this Repository

This repository contains the code and documentation for the SAFE-D Assurance platform—a web application for building trustworthy and ethical assurance cases, developed by researchers at the [Alan Turing Institute](https://www.google.com/url?sa=t&source=web&cd=&cad=rja&uact=8&ved=2ahUKEwi-4ZW65bL-AhXJMMAKHfeGCJ8QFnoECBUQAQ&url=https%3A%2F%2Fwww.turing.ac.uk%2F&usg=AOvVaw0uxvZzQpCGw78bVsaCsSOm).

## What is SAFE-D Assurance?

> SAFE-D assurance is a methodology and procedure for developing a structured argument, which provides reviewable (and contestable) assurance that a set of claims about a normative goal of a data-driven technology are warranted given the available evidence.

The following elements are central to this methodology and procedure:

- **The SAFE-D Principles**: a set of five operationalisable ethical principles—Sustainability, Accountability, Fairness, Explainability, Data Stewardship—that have been carefully designed and refined to address real-world challenges associated with the design, development, and deployment of data-driven technologies.
- **Assurance Cases**: the documented argument that communicates the basis for how and why a goal has been achieved.
- **Argument Patterns**:  starting templates for building assurance cases. They identify the types of claims (or, the sets of reasons) that need to be established to justify the associated top-level normative goal.

The SAFE-D Assurance platform brings these elements together in a usable and accessible manner, and helps project teams to provide trustworthy and justifiable assurance about the processes they undertook when designing, developing, and deploying their technology or system.

## Installation Instructions

<!-- Need to move to wiki and update -->

At present, a demo version of the SAFE-D Assurance platform is available at [https://assuranceplatform.azurewebsites.net/](https://assuranceplatform.azurewebsites.net/).

If you would prefer to run the platform locally, please follow these instructions:

### Local running via Docker

*NB: The following instructions assume knowledge of docker and docker-compose.*

1. Clone the AssurancePlatform repository to your local machine, and cd to the main `AssurancePlatform` directory.
2. ```docker-compose pull; docker-compose up```
3. Navigate to `http://localhost:3000`.
4. When you would like to stop, open a new terminal, navigate to the `AssurancePlatform` directory, and run ```docker-compose down```.

### Installation (for local running)

1. Download or clone the AssurancePlatform repository to your local machine.

**Set up and run the backend**

2. Install Python v. 3.8 or higher.
3. Create a new Python environment (e.g. if you are using conda type ```conda create --name eapenv```).
4. Activate your new virtual environment. e.g. ```conda activate eapenv```.
5. cd to the `eap_backend` directory where the file `requirements.txt` is located.
6. Install the requirements from the requirements.txt file with ```pip install -r requirements.txt``` in your shell.
7. Setup the database (this will create a local sqlite file by default)  ```python manage.py migrate```
8. Run the django tests: ```python manage.py test```
9. run the API ```python manage.py runserver```.  By default, the API will use port 8000 on localhost.

**Setup and run the frontend**

10. Install [npm](https://www.npmjs.com/)
 - For Debian or Ubuntu-based Linux, ```sudo apt install nodejs; sudo apt install npm```
 - For CentOS or Fedora-based Linux, ```sudo yum install nodejs npm```
 - For OSX using homebrew, ```brew install npm```
 - For Windows, download and install from the official website.
11. Open a new terminal while the backend is running and navigate to the frontend folder ```cd frontend```
12. Install npm dependencies: ```npm install```
13. Run the react tests: ```npm run test```
14. Run the development server ```npm start``` - this will launch a browser tab pointing to the web app at `http://localhost:3000`

### Further details on the frontend

Can be found [here](frontend/README.md)

### Further details on the backend

Can be found [here](eap_backend/README.md)

### API documentation

Can be found [here](eap_backend/eap_api/API_docs.md)

### Documentation on deploying the platform to Microsoft Azure cloud

Can be found [here](HOWTO_deploy_to_Azure.md)

### Instructions on how to reset the database

Can be found [here](HOWTO_reset_the_database.md)

## Further Resources

- Burr, C., & Leslie, D. (2022). Ethical assurance: A practical approach to the responsible design, development, and deployment of data-driven technologies. AI and Ethics. [https://doi.org/10.1007/s43681-022-00178-0](https://doi.org/10.1007/s43681-022-00178-0)
- Burr, C. and Powell, R., (2022) Trustworthy Assurance of Digital Mental Healthcare. The Alan Turing Institute. [https://doi.org/10.5281/zenodo.7107200](https://doi.org/10.5281/zenodo.7107200)

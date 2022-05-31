# AssurancePlatform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)[![Build Status](https://app.travis-ci.com/alan-turing-institute/AssurancePlatform.svg?branch=MVP)](https://app.travis-ci.com/alan-turing-institute/AssurancePlatform)

The purpose of this project is to provide a web interface to facilitate the creation of Assurance Cases.  The Assurance Cases are depicted as a flowchart, where Evidence, Arguments, and Claims are used to provide justification for an overall Goal.

The web application consists of a database (Postgresql, or sqlite for testing), a backend API (using Python/Django), and a frontend (using React).  These three components can be run on a user's machine for testing or development, or deployed on separate servers, e.g. on the cloud.


## Local running via docker / docker-compose
(if you would rather install and run the software on your machine, skip to the section below).
1. Clone the AssurancePlatform repository to your local machine, and cd to the main `AssurancePlatform` directory.
2. ```docker-compose up```
3. Navigate to `http://localhost:3000`.
4. When you would like to stop, open a new terminal, navigate to the `AssurancePlatform` directory, and run ```docker-compose down```.


## Installation (for local running)

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
 * For Debian or Ubuntu-based Linux, ```sudo apt install nodejs; sudo apt install npm```
 * For CentOS or Fedora-based Linux, ```sudo yum install nodejs npm```
 * For OSX using homebrew, ```brew install npm```
 * For Windows, download and install from the official website.

11. Open a new terminal while the backend is running and navigate to the frontend folder ```cd frontend```

12. Install npm dependencies: ```npm install```

13. Run the react tests: ```npm run test```

14. Run the development server ```npm start``` - this will launch a browser tab pointing to the web app at `http://localhost:3000`

## Further details on the frontend

Can be found [here](frontend/README.md)

## Further details on the backend

Can be found [here](eap_backend/README.md)

## API documentation

Can be found [here](eap_backend/eap_api/API_docs.md)

## Documentation on deploying the platform to Microsoft Azure cloud

Can be found [here](HOWTO_deploy_to_Azure.md)

## Resources
- Article on ethical assurance methodology ([OneDrive Link](https://thealanturininstitute-my.sharepoint.com/:b:/g/personal/cburr_turing_ac_uk/EYHu_zD4Oq1Hmq8VGrJ_EsUBNrO1LGhpV2E9AaEUavioMQ?e=qCFKo2))
- [Uber Safety Case](https://uberatgresources.com/safetycase/gsn)
- [Goal Structuring Notation](https://scsc.uk/gsn?page=gsn%206tools): GSN is a popular framework/standard for building safety cases, and has a range of tools available to support the building of assurance cases

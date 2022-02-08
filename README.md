# AssurancePlatform
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)[![Build Status](https://app.travis-ci.com/alan-turing-institute/AssurancePlatform.svg?branch=MVP)](https://app.travis-ci.com/alan-turing-institute/AssurancePlatform)

Project to facilitate creation of Assurance Cases

## Installation


**Prepare the files**

1. Download or clone the AssurancePlatform repository to your local machine or VM.

**Set up Python and npm**

2. Install Python v. 3.8 or higher.

3. Install [npm](https://www.npmjs.com/) ```brew install npm``` or if windows user downloaded and install it from the official website.  

4. Create a new Python environment (e.g. if you are using conda type ```conda create --name eapenv``` ).

5. Activate your new virtual environment. e.g. ```conda activate eapenv```.

6. cd to the eapbackend directory where requirements.txt is located.

7. Install the requirements from the requirements.txt file. 
To do that run: ```pip install -r requirements.txt``` in your shell.
You can check if all the requirements are installed properly using the command ```pip freeze``` and compare the list to the requirements.txt.


**Run the backend**

8. while in the eapbackend folder, run ```python manage.py test``` to test fucntions

9. apply migrations ```python manage.py migrate```

10. run the webapp ```python managepy runserver```

**Run the frontend**

11. Open a new terminal while the backend is running and navigate to the frontend folder ```cd eapfrontend```

12. Install npm dependencies: ```npm install```

14. Run the webapp ```npm start``` to view the app in your localhost:3000


## Resources
- Article on ethical assurance methodology ([OneDrive Link](https://thealanturininstitute-my.sharepoint.com/:b:/g/personal/cburr_turing_ac_uk/EYHu_zD4Oq1Hmq8VGrJ_EsUBNrO1LGhpV2E9AaEUavioMQ?e=qCFKo2))
- [Uber Safety Case](https://uberatgresources.com/safetycase/gsn)
- [Goal Structuring Notation](https://scsc.uk/gsn?page=gsn%206tools): GSN is a popular framework/standard for building safety cases, and has a range of tools available to support the building of assurance cases


//conda create --name eap python=3.8
//pip3 install -r requirements.txt
echo runing the webapp
call "C:\ProgramData\Anaconda3\Scripts\activate.bat" activate eap
python eap_backend\manage.py runserver


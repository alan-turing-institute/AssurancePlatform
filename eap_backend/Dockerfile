FROM nikolaik/python-nodejs
COPY . /eap_backend
WORKDIR /eap_backend
RUN npm install -g @mermaid-js/mermaid-cli
RUN pip install -r requirements.txt
RUN python manage.py migrate
CMD python manage.py migrate && python manage.py runserver 0.0.0.0:8000

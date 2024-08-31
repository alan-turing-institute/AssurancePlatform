FROM nikolaik/python-nodejs
COPY . /eap_websockets
WORKDIR /eap_websockets
RUN pip install -r requirements.txt
# TODO(cgavidia): Retrieve valid hosts from config. This is only temporary.
CMD python app.py --debug

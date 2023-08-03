FROM node:20.3.1
COPY . /frontend
WORKDIR /frontend
RUN npm install
RUN npm run build
RUN npm install serve -g
ENTRYPOINT [ "serve", "-s", "build" ]

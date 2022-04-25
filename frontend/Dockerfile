FROM node:16.14.2-slim
ARG BASE_URL
ENV REACT_APP_BASE_URL=$BASE_URL
COPY . /frontend
WORKDIR /frontend
RUN npm install
RUN npm run build
RUN npm install serve -g
ENTRYPOINT ["serve","-s","build"]

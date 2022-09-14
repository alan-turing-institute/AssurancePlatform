FROM node:16.14.2-slim
COPY . /frontend
WORKDIR /frontend
RUN npm install
RUN npm run build
RUN npm install serve -g
ENTRYPOINT ["serve","-s","build"]

FROM node:16.14.2-slim
COPY . /frontend
WORKDIR /frontend
RUN npm install
RUN npm install serve -g
CMD npm run build && serve -s build

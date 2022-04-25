FROM node:16.14.2-slim
ENV REACT_APP_BASE_URL="https://turing-assuranceplatform-backend.azurewebsites.net/api"
COPY . /frontend
WORKDIR /frontend
RUN npm install
RUN npm run build
RUN npm install serve -g
ENTRYPOINT ["serve","-s","build"]

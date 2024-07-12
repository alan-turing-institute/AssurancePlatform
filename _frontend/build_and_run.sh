#!/bin/bash

## this somewhat horrible hack is because we want to set the backend URL,
## GitHub Client ID, and GitHub Redirect URI via environment variables,
## but env vars are no longer picked up once 'npm run build' has been run,
## so we substitute the env var value in place of the default in the
## built JavaScript file :-/

if [ -n "$REACT_APP_BASE_URL" ]; then
    echo "REACT_APP_BASE_URL set to $REACT_APP_BASE_URL"
else
    echo "REACT_APP_BASE_URL not set"
    REACT_APP_BASE_URL="http://localhost:8000/api"
fi

if [ -n "$GITHUB_CLIENT_ID" ]; then
    echo "GITHUB_CLIENT_ID set to $GITHUB_CLIENT_ID"
else
    echo "GITHUB_CLIENT_ID not set"
    GITHUB_CLIENT_ID="c2c9c84887b1bf94d80b"
fi

if [ -n "$GITHUB_REDIRECT_URI" ]; then
    echo "GITHUB_REDIRECT_URI set to $GITHUB_REDIRECT_URI"
else
    echo "GITHUB_REDIRECT_URI not set"
    GITHUB_REDIRECT_URI="http://localhost:3000/login"
fi

filename=`ls build/static/js/main*.js`

# Replace default values with the new variables in one sed command
sed -e "s;http://localhost:8000/api;${REACT_APP_BASE_URL};g" \
    -e "s;c2c9c84887b1bf94d80b;${GITHUB_CLIENT_ID};g" \
    -e "s;http://localhost:3000/login;${GITHUB_REDIRECT_URI};g" $filename > tmpfile.js

mv tmpfile.js $filename

serve -s build

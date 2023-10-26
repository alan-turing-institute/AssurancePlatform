#!/bin/bash

## this somewhat horrible hack is because we want to set the backend URL
## and GitHub Client ID via environment variables, but env vars are no longer 
## picked up once 'npm run build' has been run, so we substitute the env var 
## value in place of the default URL in the built javascript file :-/

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
    GITHUB_CLIENT_ID="0cd5a829deef2e8d3a12"
fi

filename=`ls build/static/js/main*.js`

# Replace REACT_APP_BASE_URL placeholder
sed "s;http://localhost:8000/api;${REACT_APP_BASE_URL};g" $filename > tmpfile.js
mv tmpfile.js $filename

# Replace GITHUB_CLIENT_ID placeholder
sed "s;DEFAULT_GITHUB_CLIENT_ID;${GITHUB_CLIENT_ID};g" $filename > tmpfile.js
mv tmpfile.js $filename

serve -s build

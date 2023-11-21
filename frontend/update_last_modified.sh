# Get the current date in the format dd/mm/yy
formatted_date=$(date +%d-%m-%y)

# Writing to .env file
echo GENERATE_SOURCEMAP=false > .env
echo REACT_APP_GIT_COMMIT=$(git rev-parse HEAD) >> .env
echo REACT_APP_GIT_COMMIT_DATE="$formatted_date" >> .env

getDateSuffix() {
  day=$1
  if ((day == 1 || day == 21 || day == 31)); then
    echo 'st'
  elif ((day == 2 || day == 22)); then
    echo 'nd'
  elif ((day == 3 || day == 23)); then
    echo 'rd'
  else
    echo 'th'
  fi
}

day=$(date +%d | sed 's/^0*//') # removes leading zero
suffix=$(getDateSuffix $day)
formatted_date=$(git log -1 --date=format:"%A the %d$suffix of %B %Y" --format=%cd)

echo GENERATE_SOURCEMAP=false > .env
echo REACT_APP_GIT_COMMIT=$(git rev-parse HEAD) >> .env
echo REACT_APP_GIT_COMMIT_DATE="$formatted_date" >> .env

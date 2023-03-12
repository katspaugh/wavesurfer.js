#!/bin/bash

echo "Before proceeding, please make sure you're on a clean branch with the commits you want to release (typically the master branch)."
echo ''

# Get the last released version from NPM
OLD_VERSION=$(npm show wavesurfer.js version)

# Get the new version from the user
echo "The last version was $OLD_VERSION"
echo "Please type the new version:"
read NEW_VERSION

# Update the CHANGES.md file
echo 'Updating CHANGES.md...'
head -n 3 CHANGES.md > tmp
echo "$NEW_VERSION ($(date '+%d.%m.%Y'))" >> tmp
echo "------------------" >> tmp
git log "$OLD_VERSION"..HEAD --pretty=format:"* %s" >> tmp
echo '' >> tmp
tail -n +3 CHANGES.md >> tmp
cat tmp > CHANGES.md
rm tmp

# Update the version in the package.json file
echo 'Updating package.json...'
sed -i '' -e "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" package.json
sed -i '' -e "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" bower.json

# Commit the changes
echo "Pushing the changes to release/$NEW_VERSION"
git add CHANGES.md package.json bower.json
git commit -m "Release $NEW_VERSION"
git push origin $(git branch --show-current):release/$NEW_VERSION -f

# Open a pull request via the browser
echo "Opening a pull request for release/$NEW_VERSION"
open "https://github.com/wavesurfer-js/wavesurfer.js/compare/master...release/$NEW_VERSION?expand=1"



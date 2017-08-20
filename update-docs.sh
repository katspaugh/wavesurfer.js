#!/usr/bin/env bash

BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)

git checkout master
npm run doc
git checkout $BRANCH_NAME
git add --all doc
git commit -m "updating documentation on website" -- doc
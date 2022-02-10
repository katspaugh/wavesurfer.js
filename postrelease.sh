#!/bin/bash -x
BRANCH=`git rev-parse --abbrev-ref HEAD`
git push --follow-tags origin $BRANCH

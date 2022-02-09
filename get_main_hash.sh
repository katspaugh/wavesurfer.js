#!/bin/bash -x
MAINHASH=`git fetch && git rev-parse origin/$1`
CURRENTHASH=`git rev-parse HEAD`

[ "$CURRENTHASH" == "$MAINHASH" ]

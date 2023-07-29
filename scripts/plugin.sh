#!/bin/bash

# Plugin name from argument
PLUGIN_NAME=$1

# Prompt for plugin name if not provided
if [ -z "$PLUGIN_NAME" ]
then
  echo "Enter plugin name: "
  read PLUGIN_NAME
fi

FILE_NAME=$(echo "$PLUGIN_NAME" | sed -e 's/\(.*\)/\L\1/')

cat ./scripts/plugin-template.ts.template | sed "s/Template/$PLUGIN_NAME/g" > "./src/plugins/${FILE_NAME}.ts"

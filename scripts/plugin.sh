#!/bin/bash
set -euo pipefail

# Plugin name from argument
PLUGIN_NAME=${1:-}

# Prompt for plugin name if not provided
if [ -z "$PLUGIN_NAME" ]
then
  echo "Enter plugin name: "
  read PLUGIN_NAME
fi

TEMPLATE=./scripts/plugin.ts.template
if [ ! -f "$TEMPLATE" ]; then
  echo "Error: template not found at $TEMPLATE" >&2
  exit 1
fi

FILE_NAME=$(echo "$PLUGIN_NAME" | sed -e 's/\(.*\)/\L\1/')
TARGET="./src/plugins/${FILE_NAME}.ts"

if [ -e "$TARGET" ]; then
  echo "Error: $TARGET already exists" >&2
  exit 1
fi

sed "s/Template/$PLUGIN_NAME/g" "$TEMPLATE" > "$TARGET"
echo "Created $TARGET"

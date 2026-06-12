#!/bin/bash
# Start the MongoDB MCP server with the connection string from .env
set -a
source "$(dirname "$0")/.env"
set +a

exec npx -y mongodb-mcp-server@latest \
  --transport http \
  --httpHost 0.0.0.0 \
  --httpPort 8080 \
  --disabledTools atlas-local-create-deployment,atlas-local-delete-deployment,create-collection,create-index,delete-many,drop-collection,drop-database,drop-index,rename-collection
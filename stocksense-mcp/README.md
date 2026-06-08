# StockSense MCP Server

Cloud Run deployable MongoDB MCP Server for StockSense AI.

Exposes the official `mongodb-mcp-server` over HTTP transport at `/mcp` in read-only mode.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MDB_MCP_CONNECTION_STRING` | MongoDB Atlas connection string |

## Local Development

```bash
export MDB_MCP_CONNECTION_STRING="mongodb+srv://user:pass@cluster.mongodb.net/stocksense"
npm start
```

Server listens on `http://localhost:8080/mcp`

## Docker Build

```bash
docker build -t stocksense-mcp .
docker run -p 8080:8080 -e MDB_MCP_CONNECTION_STRING="mongodb+srv://..." stocksense-mcp
```

## Cloud Run Deploy

```bash
gcloud run deploy stocksense-mcp \
  --source . \
  --port 8080 \
  --set-env-vars "MDB_MCP_CONNECTION_STRING=mongodb+srv://..." \
  --allow-unauthenticated
```

## Endpoint

`POST /mcp` - Streamable HTTP MCP endpoint (JSON-RPC over HTTP)

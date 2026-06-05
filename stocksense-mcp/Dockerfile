FROM node:20-slim

WORKDIR /app

COPY package.json .

RUN npx -y mongodb-mcp-server@latest --dryRun || true

EXPOSE 8080

CMD ["npx", "-y", "mongodb-mcp-server@latest", "--transport", "http", "--httpHost", "0.0.0.0", "--httpPort", "8080", "--readOnly"]

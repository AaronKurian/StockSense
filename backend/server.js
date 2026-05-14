import express from "express"

const app = express()
const port = Number(process.env.PORT) || 3001

app.get("/", (_req, res) => {
  res.type("text/plain").send("Hello World")
})

app.get("/health", (_req, res) => {
  res.json({ status: "ok"})
})

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`)
})

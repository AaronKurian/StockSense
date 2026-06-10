import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const nextConfig = {
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '10.90.167.37',
  ],
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig

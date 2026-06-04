const { zip } = require("bestzip")
const { existsSync, unlinkSync, readdirSync, rmSync } = require("fs")
const { join } = require("path")

const distDir = "dist"
const zipPath = join(distDir, "dist.zip")

if (existsSync(zipPath)) {
  unlinkSync(zipPath)
}

zip({ source: ".", destination: "dist.zip", cwd: distDir })
  .then(() => {
    try {
      for (const entry of readdirSync(distDir)) {
        if (entry !== "dist.zip") {
          rmSync(join(distDir, entry), { recursive: true, force: true })
        }
      }
    } catch (err) {
      console.error("Failed to clean up dist/:", err.message)
      process.exit(1)
    }
  })
  .catch((err) => {
    console.error("Failed to create dist/dist.zip:", err.message)
    process.exit(1)
  })

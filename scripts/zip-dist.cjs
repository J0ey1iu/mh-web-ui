const { zip } = require("bestzip")
const { existsSync, unlinkSync, renameSync, readdirSync, rmSync } = require("fs")
const { dirname, join } = require("path")

const distDir = "dist"
const zipName = "dist.zip"
const zipPath = join(distDir, zipName)
const zipDest = join("..", zipName)
const tmpZipPath = join(dirname(distDir), zipName)

if (existsSync(zipPath)) {
  unlinkSync(zipPath)
}
if (existsSync(tmpZipPath)) {
  unlinkSync(tmpZipPath)
}

zip({ source: ".", destination: zipDest, cwd: distDir })
  .then(() => {
    renameSync(tmpZipPath, zipPath)
    try {
      for (const entry of readdirSync(distDir)) {
        if (entry !== zipName) {
          rmSync(join(distDir, entry), { recursive: true, force: true })
        }
      }
    } catch (err) {
      console.error("Failed to clean up dist/:", err.message)
      process.exit(1)
    }
  })
  .catch((err) => {
    if (existsSync(tmpZipPath)) {
      unlinkSync(tmpZipPath)
    }
    console.error("Failed to create dist/dist.zip:", err.message)
    process.exit(1)
  })

const path = require("path")
const fs = require("fs")

const run = () => {
    const distPath = path.join(__dirname, '../dist')
    fs.rmSync(distPath, { recursive: true, force: true })
}

run()
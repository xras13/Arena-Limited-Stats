const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const svgPath = path.join(__dirname, '..', 'build', 'icon.svg')
const outPath = path.join(__dirname, '..', 'build', 'icon.png')

app.disableHardwareAcceleration()

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    useContentSize: true
  })

  const svg = fs.readFileSync(svgPath, 'utf8')
  const html = `<!doctype html><meta charset="utf-8">
    <style>html,body{margin:0;padding:0;background:transparent;width:1024px;height:1024px;overflow:hidden}
    svg{display:block;width:1024px;height:1024px}</style>${svg}`
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 600))

  const image = await win.webContents.capturePage()
  const size = image.getSize()
  fs.writeFileSync(outPath, image.toPNG())
  console.log(`wrote ${outPath} at ${size.width}x${size.height}`)
  app.quit()
})

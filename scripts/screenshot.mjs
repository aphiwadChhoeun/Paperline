import { writeFile } from 'node:fs/promises'

const port = process.argv[2] ?? '9222'
const output = process.argv[3] ?? 'screenshot.png'
const buttonText = process.argv[4] ?? 'Try sample'
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const target = list.find((item) => item.type === 'page')
if (!target) throw new Error('No Chrome page target found')

const socket = new WebSocket(target.webSocketDebuggerUrl)
let nextId = 1
const pending = new Map()

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(message.error.message))
    else resolve(message.result)
  }
})

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

function send(method, params = {}) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  return result.result?.value
}

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: 'http://127.0.0.1:5173/' })
await new Promise((resolve) => setTimeout(resolve, 1600))
await evaluate(
  `(() => { const b = [...document.querySelectorAll('button')].find((item) => item.innerText.includes(${JSON.stringify(buttonText)})); if (b) b.click(); return Boolean(b); })()`,
)

for (let attempt = 0; attempt < 40; attempt += 1) {
  const title = await evaluate('document.title')
  if (title !== 'Paperline — PDF editor') break
  await new Promise((resolve) => setTimeout(resolve, 250))
}
await new Promise((resolve) => setTimeout(resolve, 1800))

const shot = await send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: false,
})
await writeFile(output, Buffer.from(shot.data, 'base64'))
console.log(`Wrote ${output}`)
socket.close()

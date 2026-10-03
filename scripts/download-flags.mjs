import fs from 'node:fs'
import path from 'node:path'

const flagsDir = path.resolve('public/flags')
if (!fs.existsSync(flagsDir)) {
  fs.mkdirSync(flagsDir, { recursive: true })
}

const codes = [
  'vn', 'us', 'gb', 'cn', 'jp', 'kr', 'fr', 'de', 'es', 'ru',
  'it', 'pt', 'sa', 'in', 'th', 'id', 'my', 'tr', 'pl', 'nl',
  'se', 'dk', 'fi', 'no', 'cz', 'gr', 'il', 'ro', 'hu', 'ua',
  'ph', 'za', 'am', 'az', 'by', 'bd', 'ba', 'bg', 'mw', 'hr',
  'ee', 'ge', 'ng', 'is', 'ie', 'kz', 'kg', 'lv', 'cd', 'lt',
  'lu', 'mk', 'np', 'af', 'ir', 'rs', 'pk', 'sk', 'si', 'so',
  'ke', 'au', 'br', 'ca', 'mx', 'sg'
]

async function downloadAll() {
  console.log(`Downloading ${codes.length} flags into ${flagsDir}...`)
  await Promise.all(
    codes.map(async (code) => {
      const filePath = path.join(flagsDir, `${code}.svg`)
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 100) {
        return
      }
      try {
        const res = await fetch(`https://hatscripts.github.io/circle-flags/flags/${code}.svg`)
        if (res.ok) {
          const text = await res.text()
          fs.writeFileSync(filePath, text, 'utf-8')
          console.log(`[OK] ${code}`)
        } else {
          console.error(`[FAIL ${res.status}] ${code}`)
        }
      } catch (err) {
        console.error(`[ERR] ${code}:`, err.message)
      }
    })
  )
  const count = fs.readdirSync(flagsDir).length
  console.log(`Finished! Total flags in public/flags: ${count}`)
}

downloadAll()

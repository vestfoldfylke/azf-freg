import { readFileSync } from 'node:fs'

const inputPath = './cert/maskinporten_private.pem'

const privateKey = readFileSync(inputPath, 'utf8')
const privateKeyBase64 = Buffer.from(privateKey).toString('base64')

console.log(`\ncopy and paste to environment variables/local.settings.json \nMASKINPORTEN_PRIVATE_KEY_BASE64="${privateKeyBase64}"\n\n`)

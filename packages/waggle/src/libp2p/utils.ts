import { formatPEM } from '@zbayapp/identity'
import { Certificate } from 'pkijs'

export function dumpPEM(tag: string, body: string | Certificate | CryptoKey) {
  let bodyCert: string
  if (typeof body === 'string') {
    bodyCert = formatPEM(body)
  } else {
    // @ts-ignore
    bodyCert = formatPEM(Buffer.from(body).toString('base64'))
  }
  const result = (
    `-----BEGIN ${tag}-----\n` +
    `${bodyCert}\n` +
    `-----END ${tag}-----\n`
  )
  return Buffer.from(result)
}

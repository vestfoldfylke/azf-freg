// We only decode, as built-in Entra auth verifies. Decode only for metadata — not authentication.

interface RawJwtPayload {
  upn?: string
  appid?: string
  oid?: string
  roles?: string[]
}

export interface DecodeResult {
  upn: string
  appid: string
  oid: string
  verified: boolean
  msg: string
  roles: string[]
}

const decodeJwt = (token: string): RawJwtPayload => {
  const base64Payload = token.replace('Bearer ', '').split('.')[1]
  if (!base64Payload) {
    throw new Error('Token is not a valid jwt')
  }
  const payload = Buffer.from(base64Payload, 'base64url').toString()
  return JSON.parse(payload) as RawJwtPayload
}

export const decodeAadToken = (token: string | undefined): DecodeResult => {
  const result: DecodeResult = {
    upn: '',
    appid: '',
    oid: '',
    verified: false,
    msg: '',
    roles: []
  }

  if (!token) {
    result.msg = 'Missing token in authorization header'
    return result
  }

  let decoded: RawJwtPayload
  try {
    decoded = decodeJwt(token)
  } catch (_error) {
    result.msg = 'Token is not a valid jwt'
    return result
  }

  if (!decoded) {
    result.msg = 'Token is not a valid jwt'
    return result
  }

  const { upn, appid, roles, oid } = decoded
  if (!upn && !appid) {
    result.msg = 'Token is missing upn or appId'
    return result
  }

  result.appid = appid ?? ''
  result.upn = upn ?? 'appReg'
  result.oid = oid ?? ''
  result.verified = true
  result.roles = roles ?? []

  return result
}

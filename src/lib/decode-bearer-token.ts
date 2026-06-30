// SECURITY: This function does NOT verify the JWT signature.
// It relies on Azure Easy Auth (App Service Authentication v2) being enforced
// in front of every caller. Enforcement is asserted in Terraform via
// auth_settings_v2 { require_authentication = true, unauthenticated_action = "Return401" }.
// Do not call decodeAadToken from any handler that is not behind Easy Auth.

type RawJwtPayload = {
  upn?: string
  appid?: string
  oid?: string
  roles?: string[]
}

export type DecodeResult = { ok: true; appid: string; upn: string | null; oid: string; roles: string[] } | { ok: false; reason: string }

const decodeJwt = (token: string): RawJwtPayload => {
  const base64Payload = token.replace('Bearer ', '').split('.')[1]
  if (!base64Payload) {
    throw new Error('Token is not a valid jwt')
  }
  const payload = Buffer.from(base64Payload, 'base64url').toString()
  return JSON.parse(payload) as RawJwtPayload
}

export const decodeAadToken = (token: string | undefined): DecodeResult => {
  if (!token) {
    return { ok: false, reason: 'Missing token in authorization header' }
  }

  let decoded: RawJwtPayload
  try {
    decoded = decodeJwt(token)
  } catch {
    return { ok: false, reason: 'Token is not a valid jwt' }
  }

  if (!decoded) {
    return { ok: false, reason: 'Token is not a valid jwt' }
  }

  const { upn, appid, roles, oid } = decoded
  if (!upn && !appid) {
    return { ok: false, reason: 'Token is missing upn or appId' }
  }

  if (!roles || !Array.isArray(roles) || roles.length === 0 || !roles.every((role) => typeof role === 'string')) {
    return { ok: false, reason: 'Token is missing roles or roles is not an array of strings' }
  }

  return {
    ok: true,
    appid: appid ?? '',
    upn: upn ?? null,
    oid: oid ?? '',
    roles: roles ?? []
  }
}

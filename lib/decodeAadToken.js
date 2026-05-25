// We only decode, as built in entra auth verifies. Decode only for metadata - not authentication.
const decodeJwt = (token) => {
  const base64Payload = token.replace("Bearer ", "").split(".")[1]
  const payload = Buffer.from(base64Payload, "base64url").toString()
  return JSON.parse(payload)
}

/**
 * @typedef {Object} Decoded
 * @property {string} upn - UserPrincipalName
 * @property {string} appid - Application id
 * @property {boolean} verified - If the token passes the checks
 * @property {string} msg - Descriptive message if the verification fails
 * @property {Array} roles - Roles for the token
 */

/**
 *
 * @param {string} token
 * @return {Decoded}
 */
module.exports = (token) => {
  const result = {
    upn: "",
    appid: "",
    oid: "",
    verified: false,
    msg: "",
    roles: []
  }

  if (!token) {
    result.msg = "Missing token in authorization header"
    return result
  }

  let decoded
  try {
    decoded = decodeJwt(token)
  } catch (_error) {
    result.msg = "Token is not a valid jwt"
    return result
  }

  if (!decoded) {
    result.msg = "Token is not a valid jwt"
    return result
  }

  const { upn, appid, roles, oid } = decoded
  if (!upn && !appid) {
    result.msg = "Token is missing upn or appId"
    return result
  }

  result.appid = appid
  result.upn = upn || "appReg"
  result.oid = oid
  result.verified = true
  result.roles = roles || []

  return result
}

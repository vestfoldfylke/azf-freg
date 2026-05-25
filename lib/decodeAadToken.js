const { decode } = require('jsonwebtoken')

module.exports = (token) => {
  const result = {
    upn: '',
    appid: '',
    verified: false,
    msg: '',
    roles: []
  }
  if (!token) {
    result.msg = 'Missing token in authorization header'
    return result
  }
  let decoded
  try {
    decoded = decode(token.replace('Bearer ', ''))
  } catch (_error) {
    result.msg = 'Token is not a valid jwt'
    return result
  }
  if (!decoded) {
    result.msg = 'Token is not a valid jwt'
    return result
  }
  const { upn, appid, roles } = decoded
  if (!upn && !appid) {
    result.msg = 'Token is missing upn or appId'
    return result
  }
  result.appid = appid
  result.upn = upn || 'appReg'
  result.verified = true
  result.roles = roles || []
  return result
}

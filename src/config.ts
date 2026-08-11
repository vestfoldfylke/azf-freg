export const config = {
  MASKINPORTEN: {
    DISCOVERY_URL: process.env.MASKINPORTEN_DISCOVERY_URL,
    SCOPE: process.env.MASKINPORTEN_SCOPE,
    CLIENT_ID: process.env.MASKINPORTEN_CLIENT_ID,
    KID: process.env.MASKINPORTEN_KID,
    PRIVATE_KEY_BASE64: process.env.MASKINPORTEN_PRIVATE_KEY_BASE64
  },
  FREG: {
    URL: process.env.FREG_URL,
    RETTIGHET: process.env.FREG_RETTIGHET
  },
  API_ROLE: process.env.API_ROLE ?? 'Freg.Read'
}

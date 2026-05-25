export const config = {
  env: process.env.NODE_ENV ?? 'dev',
  maskinporten: {
    discoveryUrl: process.env.MASKINPORTEN_DISCOVERY_URL,
    scope: process.env.MASKINPORTEN_SCOPE,
    clientId: process.env.MASKINPORTEN_CLIENT_ID,
    kid: process.env.MASKINPORTEN_KID,
    privateKeyBase64: process.env.MASKINPORTEN_PRIVATE_KEY_BASE64
  },
  freg: {
    url: process.env.FREG_URL ?? 'www.vg.vg.vg.no',
    rettighet: process.env.FREG_RETTIGHET ?? 'rettighet'
  },
  apiRole: process.env.API_ROLE ?? 'Freg.Read'
}

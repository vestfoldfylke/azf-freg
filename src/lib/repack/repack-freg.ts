// ── Constants ────────────────────────────────────────────────────────────────

const addressDelimiter = ', '

const skipWords = /^(i|og|von|av|fra|de)$/

const dontContactStatuses = ['doed', 'opphoert']

// Adressegradering values that hide the underlying address unless includeFortrolig is set.
const protectedGraderingLabels: Record<string, string> = {
  fortrolig: 'Fortrolig adresse',
  strengtfortrolig: 'Strengt fortrolig adresse',
  klientadresse: 'Klientadresse'
}

// ── FREG API response types ──────────────────────────────────────────────────

type PoststedInfo = {
  postnummer: string
  poststedsnavn: string
}

type VegAdresse = {
  adressenavn: string
  adressenummer?: {
    husnummer: string
    husbokstav?: string
  }
  poststed: PoststedInfo
}

type MatrikkelAdresse = {
  coAdressenavn?: string
  adressetilleggsnavn?: string
  poststed: PoststedInfo
}

type PostboksAdresse = {
  postbokseier?: string
  postboks: string
  poststed: PoststedInfo
}

type PostadresseIFrittFormat = {
  adresselinje?: string[]
  poststed: PoststedInfo
}

type UtenlandskAdresse = {
  coAdressenavn?: string
  postboks?: string
  adressenavn?: string
  bygning?: string
  boenhet?: string
  etasjenummer?: string
  byEllerStedsnavn?: string
  region?: string
  distriktsnavn?: string
  postkode?: string
  landkode: string
}

type UtenlandskAdresseIFrittFormat = {
  adresselinje?: string[]
  postkode?: string
  byEllerStedsnavn?: string
  landkode: string
}

type FregAddressEntry = {
  erGjeldende: boolean
  adressegradering: string
  vegadresse?: VegAdresse
  matrikkeladresse?: MatrikkelAdresse
  ukjentBosted?: unknown
  postboksadresse?: PostboksAdresse
  postadresseIFrittFormat?: PostadresseIFrittFormat
  utenlandskAdresse?: UtenlandskAdresse
  utenlandskAdresseIFrittFormat?: UtenlandskAdresseIFrittFormat
  adressenErUkjent?: boolean
}

type FregStatus = {
  erGjeldende: boolean
  status: string
}

type FregNavn = {
  erGjeldende: boolean
  fornavn: string
  mellomnavn?: string
  etternavn: string
}

type FregIdentifikasjonsnummer = {
  erGjeldende: boolean
  foedselsEllerDNummer: string
}

type FregFoedsel = {
  erGjeldende: boolean
  foedselsdato: string
}

type FregDoedsfall = {
  erGjeldende: boolean
}

type FregAdressebeskyttelse = {
  erGjeldende: boolean
  graderingsnivaa: string
}

export type FregRelasjon = {
  erGjeldende: boolean
  [key: string]: unknown
}

export type FregPerson = {
  status: FregStatus[]
  navn: FregNavn[]
  identifikasjonsnummer: FregIdentifikasjonsnummer[]
  foedsel: FregFoedsel[]
  doedsfall?: FregDoedsfall
  adressebeskyttelse?: FregAdressebeskyttelse[]
  bostedsadresse?: FregAddressEntry[]
  deltBosted?: FregAddressEntry[]
  oppholdsadresse?: FregAddressEntry[]
  postadresse?: FregAddressEntry[]
  postadresseIUtlandet?: FregAddressEntry[]
  foreldreansvar?: FregRelasjon[]
  familierelasjon?: FregRelasjon[]
}

// ── Public output types ──────────────────────────────────────────────────────

export type RepackOptions = {
  includeRawFreg?: boolean
  includeFortrolig?: boolean
  includeForeldreansvar?: boolean
  includeFamilie?: boolean
}

export type Address = {
  adressegradering: string
  gateadresse: string
  postnummer: string
  poststed: string
  landkode: string
}

export type RepackedPerson = {
  foedselsEllerDNummer: string
  status: string
  kanKontaktes: boolean
  fornavn: string
  etternavn: string
  fulltnavn: string
  foedselsdato: string | undefined
  alder: number | null
  doedsfall: FregDoedsfall | null
  adressebeskyttelse: string[]
  bostedsadresse: Address | null
  deltbostedsadresse: Address | null
  oppholdsadresse: Address | null
  postadresse: Address
  postadresseIUtlandet: Address | null
  foreldreansvar?: FregRelasjon[]
  familie?: FregRelasjon[]
  rawFreg?: FregPerson
}

// ── Defaults ─────────────────────────────────────────────────────────────────

type AddressDetails = Omit<Address, 'adressegradering'>

const defaultAddressDetails: AddressDetails = {
  gateadresse: 'Ukjent adresse',
  postnummer: '9999',
  poststed: 'UKJENT',
  landkode: 'NO'
}

const defaultPostAdresse: Address = {
  ...defaultAddressDetails,
  adressegradering: 'ugradert'
}

// ── Generic helpers ──────────────────────────────────────────────────────────

const isNonEmpty = (value: string | undefined): value is string => Boolean(value)

const joinNonEmpty = (parts: Array<string | undefined>, separator = addressDelimiter): string => parts.filter(isNonEmpty).join(separator)

const currentEntry = <T extends { erGjeldende: boolean }>(arr: T[] | undefined): T | undefined => arr?.find((entry) => entry.erGjeldende)

const currentEntries = <T extends { erGjeldende: boolean }>(arr: T[] | undefined): T[] => arr?.filter((entry) => entry.erGjeldende) ?? []

const capitalizeWord = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()

export const capitalizeWords = (data: string): string =>
  data
    .split(' ')
    .map((word, index) => {
      const isSkipWord = index > 0 && skipWords.test(word.toLowerCase())
      return isSkipWord ? word.toLowerCase() : capitalizeWord(word)
    })
    .join(' ')

export const getAge = (birthDate: string): number => {
  const birth = new Date(birthDate)
  const now = new Date()
  const hasHadBirthdayThisYear = now.getMonth() > birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate())
  return now.getFullYear() - birth.getFullYear() - (hasHadBirthdayThisYear ? 0 : 1)
}

// ── Address builders ─────────────────────────────────────────────────────────
// One builder per FREG address shape. Each returns the address fields without
// adressegradering — getAddress wraps the result with the gradering value.

const buildVegadresse = (a: VegAdresse): AddressDetails => {
  const husnummer = a.adressenummer ? `${a.adressenummer.husnummer}${a.adressenummer.husbokstav ?? ''}` : ''
  return {
    gateadresse: husnummer ? `${a.adressenavn} ${husnummer}` : a.adressenavn,
    postnummer: a.poststed.postnummer || defaultAddressDetails.postnummer,
    poststed: a.poststed.poststedsnavn || defaultAddressDetails.poststed,
    landkode: defaultAddressDetails.landkode
  }
}

const buildMatrikkeladresse = (a: MatrikkelAdresse): AddressDetails => {
  const tilleggsnavn = a.adressetilleggsnavn ?? defaultAddressDetails.gateadresse
  return {
    gateadresse: a.coAdressenavn ? `${a.coAdressenavn} ${tilleggsnavn}` : tilleggsnavn,
    postnummer: a.poststed.postnummer || defaultAddressDetails.postnummer,
    poststed: a.poststed.poststedsnavn || defaultAddressDetails.poststed,
    landkode: defaultAddressDetails.landkode
  }
}

const buildPostboksadresse = (a: PostboksAdresse): AddressDetails => ({
  gateadresse: joinNonEmpty([a.postbokseier, a.postboks]),
  postnummer: a.poststed.postnummer || defaultAddressDetails.postnummer,
  poststed: a.poststed.poststedsnavn || defaultAddressDetails.poststed,
  landkode: defaultAddressDetails.landkode
})

const buildPostadresseIFrittFormat = (a: PostadresseIFrittFormat): AddressDetails => ({
  gateadresse: joinNonEmpty(a.adresselinje ?? []) || 'Unknown address',
  postnummer: a.poststed.postnummer || defaultAddressDetails.postnummer,
  poststed: a.poststed.poststedsnavn || defaultAddressDetails.poststed,
  landkode: defaultAddressDetails.landkode
})

const buildUtenlandskAdresse = (a: UtenlandskAdresse): AddressDetails => ({
  gateadresse: joinNonEmpty([a.coAdressenavn, a.postboks, a.adressenavn, a.bygning, a.boenhet, a.etasjenummer]) || 'Unknown address',
  postnummer: a.postkode || 'Unknown post code',
  poststed: joinNonEmpty([a.byEllerStedsnavn, a.region, a.distriktsnavn]) || 'UNKNOWN',
  landkode: a.landkode
})

const buildUtenlandskAdresseIFrittFormat = (a: UtenlandskAdresseIFrittFormat): AddressDetails => ({
  gateadresse: joinNonEmpty(a.adresselinje ?? []) || 'Unknown address',
  postnummer: a.postkode || 'Unknown post code',
  poststed: a.byEllerStedsnavn || 'UNKNOWN',
  landkode: a.landkode
})

const extractAddressDetails = (entry: FregAddressEntry): AddressDetails => {
  if (entry.vegadresse) {
    return buildVegadresse(entry.vegadresse)
  }
  if (entry.matrikkeladresse) {
    return buildMatrikkeladresse(entry.matrikkeladresse)
  }
  if (entry.postboksadresse) {
    return buildPostboksadresse(entry.postboksadresse)
  }
  if (entry.postadresseIFrittFormat) {
    return buildPostadresseIFrittFormat(entry.postadresseIFrittFormat)
  }
  if (entry.utenlandskAdresse) {
    return buildUtenlandskAdresse(entry.utenlandskAdresse)
  }
  if (entry.utenlandskAdresseIFrittFormat) {
    return buildUtenlandskAdresseIFrittFormat(entry.utenlandskAdresseIFrittFormat)
  }
  if (entry.ukjentBosted || entry.adressenErUkjent) {
    return { ...defaultAddressDetails }
  }
  throw new Error('This is not an address!')
}

const getAddress = (entry: FregAddressEntry | null | undefined, options: RepackOptions = {}): Address | null => {
  if (!entry) {
    return null
  }

  const protectedLabel = options.includeFortrolig ? undefined : protectedGraderingLabels[entry.adressegradering.toLowerCase()]
  if (protectedLabel) {
    return {
      ...defaultAddressDetails,
      adressegradering: entry.adressegradering,
      gateadresse: protectedLabel
    }
  }

  return {
    ...extractAddressDetails(entry),
    adressegradering: entry.adressegradering
  }
}

// ── Name builder ─────────────────────────────────────────────────────────────

type FullName = { fornavn: string; etternavn: string; fulltnavn: string }

const buildFullName = (navn: FregNavn): FullName => {
  const fornavn = [navn.fornavn, navn.mellomnavn].filter(isNonEmpty).map(capitalizeWords).join(' ')
  const etternavn = capitalizeWords(navn.etternavn)
  return { fornavn, etternavn, fulltnavn: `${fornavn} ${etternavn}` }
}

// ── Main export ──────────────────────────────────────────────────────────────

export const repackFreg = (fregRes: FregPerson, options: RepackOptions = {}): RepackedPerson => {
  const { includeRawFreg, includeForeldreansvar, includeFamilie } = options

  const status = currentEntry(fregRes.status)?.status ?? 'Ukjent status'
  const kanKontaktes = !dontContactStatuses.includes(status)

  const navn = currentEntry(fregRes.navn)
  if (!navn) {
    throw new Error('Person does not have a valid name')
  }
  const { fornavn, etternavn, fulltnavn } = buildFullName(navn)

  const foedselsEllerDNummer = currentEntry(fregRes.identifikasjonsnummer)?.foedselsEllerDNummer
  if (!foedselsEllerDNummer) {
    throw new Error('Person does not have a valid id-number (ssn)')
  }

  const foedselsdato = currentEntry(fregRes.foedsel)?.foedselsdato
  const alder = foedselsdato ? getAge(foedselsdato) : null
  const doedsfall = fregRes.doedsfall?.erGjeldende ? fregRes.doedsfall : null

  const adressebeskyttelse = currentEntries(fregRes.adressebeskyttelse).map((entry) => entry.graderingsnivaa)

  const bostedsadresse = getAddress(currentEntry(fregRes.bostedsadresse), options)
  const deltbostedsadresse = getAddress(currentEntry(fregRes.deltBosted), options)
  const oppholdsadresse = getAddress(currentEntry(fregRes.oppholdsadresse), options)
  const postadresseIUtlandet = getAddress(currentEntry(fregRes.postadresseIUtlandet), options)

  // Fallback chain for postadresse: own postadresse → bosted → delt bosted → opphold → utenlandsk → default.
  const postadresse = getAddress(currentEntry(fregRes.postadresse), options) ??
    bostedsadresse ??
    deltbostedsadresse ??
    oppholdsadresse ??
    postadresseIUtlandet ?? { ...defaultPostAdresse }

  const repacked: RepackedPerson = {
    foedselsEllerDNummer,
    status,
    kanKontaktes,
    fornavn,
    etternavn,
    fulltnavn,
    foedselsdato,
    alder,
    doedsfall,
    adressebeskyttelse,
    bostedsadresse,
    deltbostedsadresse,
    oppholdsadresse,
    postadresse,
    postadresseIUtlandet
  }

  if (includeForeldreansvar) {
    repacked.foreldreansvar = currentEntries(fregRes.foreldreansvar)
  }
  if (includeFamilie) {
    repacked.familie = currentEntries(fregRes.familierelasjon)
  }
  if (includeRawFreg) {
    repacked.rawFreg = fregRes
  }

  return repacked
}

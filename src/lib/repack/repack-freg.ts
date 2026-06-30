const addressDelimiter = ', '

const skipWords = /^(i|og|von|av|fra|de)$/

const capitalizeWord = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()

export const capitalizeWords = (data: string): string =>
  data
    .split(' ')
    .map((word, index) => {
      const isSkipWord = index > 0 && skipWords.test(word.toLowerCase())
      return isSkipWord ? word.toLowerCase() : capitalizeWord(word)
    })
    .join(' ')

const trimAddress = (address: string): string => {
  const delimiterLength = addressDelimiter.length
  const lastChars = address.substring(address.length - delimiterLength, address.length + 1)
  if (lastChars === addressDelimiter) {
    return address.substring(0, address.length - delimiterLength)
  }
  return address
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
  alder: number
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

// ── Address helpers ──────────────────────────────────────────────────────────

const defaultPostAdresse: Address = {
  adressegradering: 'ugradert',
  gateadresse: 'Ukjent adresse',
  postnummer: '9999',
  poststed: 'UKJENT',
  landkode: 'NO'
}

const getAddress = (address: FregAddressEntry | null, options: RepackOptions = {}): Address | null => {
  const { includeFortrolig } = options
  if (!address) {
    return null
  }

  const usefulAddress: Address = {
    ...defaultPostAdresse,
    adressegradering: address.adressegradering
  }

  if (usefulAddress.adressegradering.toLowerCase() === 'fortrolig' && !includeFortrolig) {
    usefulAddress.gateadresse = 'Fortrolig adresse'
    return usefulAddress
  }
  if (usefulAddress.adressegradering.toLowerCase() === 'strengtfortrolig' && !includeFortrolig) {
    usefulAddress.gateadresse = 'Strengt fortrolig adresse'
    return usefulAddress
  }
  if (usefulAddress.adressegradering.toLowerCase() === 'klientadresse' && !includeFortrolig) {
    usefulAddress.gateadresse = 'Klientadresse'
    return usefulAddress
  }

  if (address.vegadresse) {
    usefulAddress.gateadresse = address.vegadresse.adressenummer
      ? `${address.vegadresse.adressenavn} ${address.vegadresse.adressenummer.husnummer}${address.vegadresse.adressenummer.husbokstav ?? ''}`
      : address.vegadresse.adressenavn
    usefulAddress.postnummer = address.vegadresse.poststed.postnummer || defaultPostAdresse.postnummer
    usefulAddress.poststed = address.vegadresse.poststed.poststedsnavn || defaultPostAdresse.poststed
  } else if (address.matrikkeladresse) {
    usefulAddress.gateadresse = `${address.matrikkeladresse.coAdressenavn ? `${address.matrikkeladresse.coAdressenavn} ` : ''}${address.matrikkeladresse.adressetilleggsnavn ?? defaultPostAdresse.gateadresse}`
    usefulAddress.postnummer = address.matrikkeladresse.poststed.postnummer || defaultPostAdresse.postnummer
    usefulAddress.poststed = address.matrikkeladresse.poststed.poststedsnavn || defaultPostAdresse.poststed
  } else if (address.ukjentBosted) {
    // ikke gjør noe (bruk default)
  } else if (address.postboksadresse) {
    usefulAddress.gateadresse = `${address.postboksadresse.postbokseier ? address.postboksadresse.postbokseier + addressDelimiter : ''}${address.postboksadresse.postboks}`
    usefulAddress.postnummer = address.postboksadresse.poststed.postnummer || defaultPostAdresse.postnummer
    usefulAddress.poststed = address.postboksadresse.poststed.poststedsnavn || defaultPostAdresse.poststed
  } else if (address.postadresseIFrittFormat) {
    let megaadresse = ''
    if (address.postadresseIFrittFormat.adresselinje) {
      megaadresse = address.postadresseIFrittFormat.adresselinje.join(addressDelimiter)
    }
    usefulAddress.gateadresse = trimAddress(megaadresse) || 'Unknown address'
    usefulAddress.postnummer = address.postadresseIFrittFormat.poststed.postnummer || defaultPostAdresse.postnummer
    usefulAddress.poststed = address.postadresseIFrittFormat.poststed.poststedsnavn || defaultPostAdresse.poststed
  } else if (address.utenlandskAdresse) {
    let megaadresse = ''
    if (address.utenlandskAdresse.coAdressenavn) {
      megaadresse += address.utenlandskAdresse.coAdressenavn + addressDelimiter
    }
    if (address.utenlandskAdresse.postboks) {
      megaadresse += address.utenlandskAdresse.postboks + addressDelimiter
    }
    if (address.utenlandskAdresse.adressenavn) {
      megaadresse += address.utenlandskAdresse.adressenavn + addressDelimiter
    }
    if (address.utenlandskAdresse.bygning) {
      megaadresse += address.utenlandskAdresse.bygning + addressDelimiter
    }
    if (address.utenlandskAdresse.boenhet) {
      megaadresse += address.utenlandskAdresse.boenhet + addressDelimiter
    }
    if (address.utenlandskAdresse.etasjenummer) {
      megaadresse += address.utenlandskAdresse.etasjenummer + addressDelimiter
    }
    let megapoststed = ''
    if (address.utenlandskAdresse.byEllerStedsnavn) {
      megapoststed += address.utenlandskAdresse.byEllerStedsnavn + addressDelimiter
    }
    if (address.utenlandskAdresse.region) {
      megapoststed += address.utenlandskAdresse.region + addressDelimiter
    }
    if (address.utenlandskAdresse.distriktsnavn) {
      megapoststed += address.utenlandskAdresse.distriktsnavn + addressDelimiter
    }
    usefulAddress.gateadresse = trimAddress(megaadresse) || 'Unknown address'
    usefulAddress.postnummer = address.utenlandskAdresse.postkode || 'Unknown post code'
    usefulAddress.poststed = trimAddress(megapoststed) || 'UNKNOWN'
    usefulAddress.landkode = address.utenlandskAdresse.landkode
  } else if (address.utenlandskAdresseIFrittFormat) {
    let megaadresse = ''
    if (address.utenlandskAdresseIFrittFormat.adresselinje) {
      megaadresse = address.utenlandskAdresseIFrittFormat.adresselinje.join(addressDelimiter)
    }
    usefulAddress.gateadresse = trimAddress(megaadresse) || 'Unknown address'
    usefulAddress.postnummer = address.utenlandskAdresseIFrittFormat.postkode || 'Unknown post code'
    usefulAddress.poststed = address.utenlandskAdresseIFrittFormat.byEllerStedsnavn || 'UNKNOWN'
    usefulAddress.landkode = address.utenlandskAdresseIFrittFormat.landkode
  } else if (address.adressenErUkjent) {
    // ikke gjør noe (bruk default)
  } else {
    throw new Error('This is not an address!')
  }

  return usefulAddress
}

export const getAge = (birthDate: string): number => {
  const birth = new Date(birthDate)
  const now = new Date()
  const hasHadBirthdayThisYear = now.getMonth() > birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate())
  return now.getFullYear() - birth.getFullYear() - (hasHadBirthdayThisYear ? 0 : 1)
}

// ── Main export ──────────────────────────────────────────────────────────────

export const repackFreg = (fregRes: FregPerson, options: RepackOptions = {}): RepackedPerson => {
  const { includeRawFreg, includeForeldreansvar, includeFamilie } = options

  const dontContactStatuses = ['doed', 'ophoert']
  const status = fregRes.status.find((ele) => ele.erGjeldende)?.status ?? 'Ukjent status'
  const kanKontaktes = !dontContactStatuses.includes(status)

  const navn = fregRes.navn.find((ele) => ele.erGjeldende)
  if (!navn) {
    throw new Error('Person does not have a valid name')
  }
  const fornavn = navn.mellomnavn ? `${capitalizeWords(navn.fornavn)} ${capitalizeWords(navn.mellomnavn)}` : capitalizeWords(navn.fornavn)
  const etternavn = capitalizeWords(navn.etternavn)
  const fulltnavn = `${fornavn} ${etternavn}`

  const foedselsEllerDNummer = fregRes.identifikasjonsnummer.find((ele) => ele.erGjeldende)?.foedselsEllerDNummer
  if (!foedselsEllerDNummer) {
    throw new Error('Person does not have a valid id-number (ssn)')
  }

  const foedselsdato = fregRes.foedsel.find((ele) => ele.erGjeldende)?.foedselsdato
  const alder = foedselsdato ? getAge(foedselsdato) : 0
  const doedsfall = fregRes.doedsfall?.erGjeldende ? fregRes.doedsfall : null

  const adressebeskyttelse = fregRes.adressebeskyttelse?.filter((ele) => ele.erGjeldende).map((ele) => ele.graderingsnivaa) ?? []

  const bostedsadresse = getAddress(fregRes.bostedsadresse?.find((ele) => ele.erGjeldende) ?? null, options)
  const deltbostedsadresse = getAddress(fregRes.deltBosted?.find((ele) => ele.erGjeldende) ?? null, options)
  const oppholdsadresse = getAddress(fregRes.oppholdsadresse?.find((ele) => ele.erGjeldende) ?? null, options)
  let postadresse = getAddress(fregRes.postadresse?.find((ele) => ele.erGjeldende) ?? null, options)
  const postadresseIUtlandet = getAddress(fregRes.postadresseIUtlandet?.find((ele) => ele.erGjeldende) ?? null, options)

  const foreldreansvar = fregRes.foreldreansvar?.filter((ele) => ele.erGjeldende) ?? []
  const familie = fregRes.familierelasjon?.filter((ele) => ele.erGjeldende) ?? []

  // En person kan ha: bostedsadresse, oppholdsadresse, postadresse og postadresse i utlandet.
  // Bruk bostedsadresse (evt delt bosted, opphold, postadresse i utlandet) som fallback for postadresse.
  if (!postadresse) {
    postadresse = bostedsadresse
  }
  if (!postadresse) {
    postadresse = deltbostedsadresse
  }
  if (!postadresse) {
    postadresse = oppholdsadresse
  }
  if (!postadresse) {
    postadresse = postadresseIUtlandet
  }
  if (!postadresse) {
    postadresse = { ...defaultPostAdresse }
  }

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
    repacked.foreldreansvar = foreldreansvar
  }
  if (includeFamilie) {
    repacked.familie = familie
  }
  if (includeRawFreg) {
    repacked.rawFreg = fregRes
  }

  return repacked
}

# azf-freg
Azure function for calling freg

# Usage
## Authentication
All api-calls must contain Authorization header with "Bearer {access_token}" from the app registration used for authenticating towards the Azure Function.

### Example header
```js
Headers: {
  Authorization: {
    'Bearer eyjkfdjifjlkdfdbfhdsnfdsøfnldsjfjds...'
  }
}
```

### How to get access token
#### With app registration and client credentials
1. Make sure you have turned on authentication on your Function App in Azure - find the app registration that is being used for authentication on the Function App
1. Create an App Role on the app registration - e,g "Freg.Read"
1. Create a new app registration to represent the caller/client
1. Create a secret or certificate for the caller/client app registration
1. Create a new API Permission on the caller/client app registration. Select the app registration for the Function App, then select Application Permission - and the App Role you created (e.g "Freg.Read")
1. Grant admin consent for the permission
1. Use the caller/client app registration to fetch a token with the following parameters:
```js
{
  grantType: "clientCredentials",
  clientId: "the client Id for the client/caller app registration",
  clientSecretOrCertificate: "the secret/certificate you created on the caller/client app registration",
  tokenUrl: "access token url from Azure",
  scope: "api://{client id for the Function App app registration}/.default"
}
```

## POST /Personer
### Example payload
```json
{
  "ssn": "12345678910",
  "includeRawFreg": false, // OPTIONAL - defaults to false
  "includeFortrolig": false, // OPTIONAL - defaults to false if not provided
  "includeForeldreansvar": false // OPTIONAL - defaults to false if not provided
}
```

### Example response
```json
{
	"foedselsEllerDNummer": "16852749559",
	"status": "bosatt",
	"kanKontaktes": true, // If status is "doed" or "opphoert" - this is set to false
	"fornavn": "Stadig",
	"etternavn": "Kubbestol",
	"fulltnavn": "Stadig Kubbestol",
	"foedselsdato": "1927-05-16",
	"alder": 95,
	"doedsfall": null,
	"adressebeskyttelse": [], // Returns array - check if it includes "fortrolig" or "strengtFortrolig"
	"bostedsadresse": { // Can be null
		"adressegradering": "ugradert", // Check for "fortrolig", "strengtFortrolig" or "klientadresse"
		"gateadresse": "Stavangvegen 90",
		"postnummer": "6944",
		"poststed": "STAVANG",
		"landkode": "NO"
	},
	"deltbostedsadresse": null,
	"oppholdsadresse": null,
	"postadresse": { // Should always have value (contact us if it does not)
		"adressegradering": "ugradert",
		"gateadresse": "Stavangvegen 90",
		"postnummer": "6944",
		"poststed": "STAVANG",
		"landkode": "NO"
	},
	"postadresseIUtlandet": null
}
```

If person with {ssn} is not found - api returns
```json
{
	"foedselsEllerDNummer": null,
	"status": "fant ingen med denne identifikasjonen"
}
```

### Optional parameters
**includeRawFreg** - boolean

If true - returns the raw data from freg along with repacked
Example response
```json
{
	"foedselsEllerDNummer": "16852749559",
	"status": "bosatt",
	"kanKontaktes": true,
	"fornavn": "Stadig",
	"etternavn": "Kubbestol",
	"fulltnavn": "Stadig Kubbestol",
	"foedselsdato": "1927-05-16",
	"alder": 95,
	"doedsfall": null,
	"adressebeskyttelse": [],
	"bostedsadresse": {
		"adressegradering": "ugradert",
		"gateadresse": "Stavangvegen 90",
		"postnummer": "6944",
		"poststed": "STAVANG",
		"landkode": "NO"
	},
	"deltbostedsadresse": null,
	"oppholdsadresse": null,
	"postadresse": {
		"adressegradering": "ugradert",
		"gateadresse": "Stavangvegen 90",
		"postnummer": "6944",
		"poststed": "STAVANG",
		"landkode": "NO"
	},
	"postadresseIUtlandet": null,
	"rawFreg": {
		"identifikasjonsnummer": [
			{
				"ajourholdstidspunkt": "2020-12-22T17:09:02.759+01:00",
				"erGjeldende": true,
				"kilde": "KILDE_DSF",
				"status": "iBruk",
				"foedselsEllerDNummer": "16852749559",
				"identifikatortype": "foedselsnummer"
			}
		],
		"status": [
			{
				"ajourholdstidspunkt": "2020-12-22T17:09:02.759+01:00",
				"erGjeldende": true,
				"kilde": "KILDE_DSF",
				"gyldighetstidspunkt": "2020-12-22T17:09:02.759+01:00",
				"status": "bosatt"
			}
		],
		"kjoenn": [
			{
				"erGjeldende": true,
				"kilde": "KILDE_DSF",
				"kjoenn": "mann"
			}
		],
		"foedsel": [
			{
				"ajourholdstidspunkt": "2022-03-11T09:14:09.688953+01:00",
				"erGjeldende": true,
				"kilde": "Synutopia",
				"gyldighetstidspunkt": "1927-05-16T09:14:09.688947+01:00",
				"foedselsdato": "1927-05-16",
				"foedselsaar": "1927",
				"foedekommuneINorge": "3024",
				"foedeland": "NOR"
			}
		],
		"familierelasjon": [
			{
				"ajourholdstidspunkt": "2022-03-29T13:01:54.993435+02:00",
				"erGjeldende": true,
				"kilde": "Synutopia",
				"aarsak": "Patch",
				"gyldighetstidspunkt": "2003-11-29T13:01:54.863608+02:00",
				"relatertPerson": "26832648492",
				"relatertPersonsRolle": "ektefelleEllerPartner",
				"minRolleForPerson": "ektefelleEllerPartner"
			},
			{
				"ajourholdstidspunkt": "2022-03-11T09:14:09.400362+01:00",
				"erGjeldende": true,
				"kilde": "Synutopia",
				"aarsak": "Patch",
				"gyldighetstidspunkt": "1965-08-28T00:00:00+01:00",
				"relatertPerson": "28886594757",
				"relatertPersonsRolle": "barn",
				"minRolleForPerson": "far"
			},
			{
				"ajourholdstidspunkt": "2022-03-17T10:28:55.820138+01:00",
				"erGjeldende": true,
				"kilde": "Synutopia",
				"aarsak": "Patch",
				"gyldighetstidspunkt": "1957-06-16T00:00:00+01:00",
				"relatertPerson": "16865798168",
				"relatertPersonsRolle": "barn",
				"minRolleForPerson": "far"
			},
			{
				"ajourholdstidspunkt": "2022-03-18T13:54:59.529454+01:00",
				"erGjeldende": true,
				"kilde": "Synutopia",
				"aarsak": "Patch",
				"gyldighetstidspunkt": "1952-05-23T00:00:00+01:00",
				"relatertPerson": "23855297515",
				"relatertPersonsRolle": "barn",
				"minRolleForPerson": "far"
			}
		],
		"sivilstand": [
			{
				"ajourholdstidspunkt": "2022-03-29T13:01:54.863609+02:00",
				"erGjeldende": true,
				"kilde": "Synutopia",
				"aarsak": "Patch",
				"gyldighetstidspunkt": "2003-11-29T13:01:54.863608+02:00",
				"sivilstand": "gift",
				"sivilstandsdato": "2003-11-29",
				"myndighet": "DEN_NORSKE_KIRKE",
				"kommune": "1120",
				"sted": "Uemosjonell Testkirke",
				"relatertVedSivilstand": "26832648492"
			}
		],
		"navn": [
			{
				"ajourholdstidspunkt": "2022-03-11T09:14:09.783692+01:00",
				"erGjeldende": true,
				"kilde": "Synutopia",
				"aarsak": "Patch",
				"gyldighetstidspunkt": "2022-03-11T09:14:09.783685+01:00",
				"fornavn": "STADIG",
				"etternavn": "KUBBESTOL"
			}
		],
		"bostedsadresse": [
			{
				"ajourholdstidspunkt": "2022-03-29T13:01:55.565637+02:00",
				"erGjeldende": true,
				"kilde": "Synutopia",
				"aarsak": "Flytting innenlands",
				"gyldighetstidspunkt": "2022-03-29T00:00:00+02:00",
				"vegadresse": {
					"kommunenummer": "4602",
					"bruksenhetsnummer": "H0101",
					"bruksenhetstype": "bolig",
					"adressenavn": "Stavangvegen",
					"adressenummer": {
						"husnummer": "90"
					},
					"adressekode": "3260",
					"poststed": {
						"poststedsnavn": "STAVANG",
						"postnummer": "6944"
					}
				},
				"adresseIdentifikatorFraMatrikkelen": "604503040",
				"adressegradering": "ugradert",
				"flyttedato": "2022-03-29",
				"grunnkrets": 106,
				"stemmekrets": 2,
				"skolekrets": 1,
				"kirkekrets": 2
			}
		],
		"statsborgerskap": [
			{
				"ajourholdstidspunkt": "2022-03-11T09:14:09.848975+01:00",
				"erGjeldende": true,
				"kilde": "Synutopia",
				"aarsak": "Fødsel",
				"gyldighetstidspunkt": "1927-05-16T09:14:09.849019+01:00",
				"statsborgerskap": "NOR",
				"ervervsdato": "1927-05-16"
			}
		]
	}
}
```

**includeFortrolig** - boolean

If true - also returns fortrolig address - use with caution. If not set to false - fortroligAddress is replaced by "Ukjent adresse, 9999 Ukjent"

**includeForeldreansvar** - boolean

If set to true - returns who has parent-responsibility for the person/child returned

# Development
- Clone repo
- `npm i`
- Create and set up local.settings.json
```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "NODE_ENV": "dev",
    "CERTIFICATE_PFX_BASE64": "base64 representation of virksomhetssertifikat.pfx", // use this OR CERTIFICATE_PFX_PATH
    "CERTIFICATE_PFX_PATH": "absolute path to virksomhetssertifikat.pfx",
    "CERTIFICATE_PASSPHRASE": "if certificate have passphrase",
    "MASKINPORTEN_ISSUER": "client id for maskinporten client",
    "MASKINPORTEN_AUDIENCE": "audience for maskinporten client",
    "MASKINPORTEN_MED_HJEMMEL_SCOPE": "prefix:scope",
    "MASKINPORTEN_UTEN_HJEMMEL_SCOPE": "prefix:scope",
    "MASKINPORTEN_AUTHORIZATION_URL": "maskinporten authorization url",
    "MASKINPORTEN_TOKEN_URL": "maskinporten token url",
		"FREG_URL": "folkeregister.tut-tut-tut-lille-bil.no/folkeregisteret",
    "FREG_RETTIGHET": "for eksempel offentlig-med-hjemmel"
  }
}
```
- Test the function with
- `func start`

# Skal du bytte virksomhetssertifikat?
**Bruk pfx**
- Last opp det nye sertifikatet som en ny versjon av det som allerede ligger i keyvaulten
- Resten skal gå av seg selv i løpet av 24 timer (sies det)

# Useful links
[Freg skatteetatens Swagger-hub](https://app.swaggerhub.com/organizations/Skatteetaten_FREG)
[Testdata fra skatteetaten](https://www.skatteetaten.no/skjema/testdata/)
[Spørsmål og svar](https://skatteetaten.github.io/folkeregisteret-api-dokumentasjon/sporsmal-og-svar/)
[Informasjonsmodell](https://skatteetaten.github.io/folkeregisteret-api-dokumentasjon/informasjonsmodell/)

Funksjonen tar seg ikke av autentisering. Dette må gjøres av AzureAD eller Apim.


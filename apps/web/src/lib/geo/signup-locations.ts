import { countryToContinent } from "@/lib/geo/continents";

export type SignupCountryCode = "CA" | "US" | "GB" | "AU" | "OTHER";

export const SIGNUP_COUNTRIES: Array<{ code: SignupCountryCode; label: string }> = [
  { code: "CA", label: "Canada" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "AU", label: "Australia" },
  { code: "OTHER", label: "Other country" },
];

export const CA_PROVINCES = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Northwest Territories",
  "Nova Scotia",
  "Nunavut",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
  "Yukon",
] as const;

export const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "District of Columbia",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
] as const;

export function regionFieldLabel(country: SignupCountryCode): string {
  if (country === "CA") return "Province";
  if (country === "US") return "State";
  return "Region / Province / State";
}

/** Store ISO code for map; OTHER stores free-text country in signupCountry. */
export function resolveStoredCountry(country: SignupCountryCode, otherCountry: string): string {
  if (country === "OTHER") return otherCountry.trim().slice(0, 64) || "OTHER";
  return country;
}

export function buildSignupGeoFromForm(params: {
  country: SignupCountryCode;
  otherCountry: string;
  region: string;
  city: string;
  ipLatitude?: number | null;
  ipLongitude?: number | null;
  ipContinent?: string | null;
}) {
  const storedCountry = resolveStoredCountry(params.country, params.otherCountry);
  const continent =
    params.country === "OTHER"
      ? (params.ipContinent ?? null)
      : countryToContinent(params.country);

  return {
    signupCountry: storedCountry,
    signupRegion: params.region.trim().slice(0, 128),
    signupCity: params.city.trim().slice(0, 128),
    signupContinent: continent,
    signupLatitude: params.ipLatitude ?? null,
    signupLongitude: params.ipLongitude ?? null,
  };
}

/** ISO 3166-1 alpha-2 codes offered in the admin country pickers. Names come from Intl.DisplayNames in the viewer's language. */
export const COUNTRY_CODES =
  "AD AE AF AG AI AL AM AO AR AS AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BQ BR BS BT BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GF GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MQ MR MS MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NZ OM PA PE PF PG PH PK PL PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VC VE VG VI VN VU WS XK YE ZA ZM ZW".split(" ");

export type CountryMode = "all" | "only" | "except";
export type CountryRule = { countryMode: string; countries: string[] };

export function countryName(code: string, locale = "en") {
  try {
    return new Intl.DisplayNames([locale === "ht" ? "fr" : locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Whether something limited by `rule` may be shown/sold to a shopper in `country`. Unknown country: only "only" rules hide it. */
export function allowedIn(rule: CountryRule, country: string | null): boolean {
  const list = rule.countries.map((c) => c.toUpperCase());
  if (rule.countryMode === "only") return !!country && list.includes(country);
  if (rule.countryMode === "except") return !country || !list.includes(country);
  return true;
}

type CountryFilter = { countryMode?: string; countries?: { has: string } } | { NOT: { countries: { has: string } }; countryMode: string };

/** Same rule as a Prisma filter, for Product, ManualMethod and HomeSlide queries. */
export function countryWhere(country: string | null): { OR: CountryFilter[] } {
  if (!country) return { OR: [{ countryMode: "all" }, { countryMode: "except" }] };
  return {
    OR: [
      { countryMode: "all" },
      { countryMode: "only", countries: { has: country } },
      { countryMode: "except", NOT: { countries: { has: country } } },
    ],
  };
}

/** Reads the admin form fields `<prefix>countryMode` and `<prefix>countries` (comma/space separated ISO codes). */
export function parseCountryRule(form: FormData, prefix = ""): CountryRule {
  const mode = String(form.get(`${prefix}countryMode`) ?? "all");
  const countries = [...new Set(String(form.get(`${prefix}countries`) ?? "").toUpperCase().split(/[\s,;]+/).filter((c) => COUNTRY_CODES.includes(c)))];
  return { countryMode: mode === "only" || mode === "except" ? (countries.length ? mode : "all") : "all", countries: mode === "all" ? [] : countries };
}

/** Short text for admin lists: "Worldwide", "Only HT", "Not in US, CA". */
export function describeRule(rule: CountryRule) {
  if (rule.countryMode === "only") return `Only ${rule.countries.join(", ")}`;
  if (rule.countryMode === "except") return `Not in ${rule.countries.join(", ")}`;
  return "Worldwide";
}

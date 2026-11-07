// Code lists for the IFC GEMs database (DATABASE_ID=IFC_GEM) on World Bank Data360.
// Codes verified against the live data API; labels match the Data360 dimensions API
// (POST https://data360api.worldbank.org/data360/portal/v1/dimensions, 2025 vintage).

export const DATABASE_ID = 'IFC_GEM';

export type DataSource = 'sovereign' | 'public' | 'private';
export const DATA_SOURCES = ['sovereign', 'public', 'private'] as const;

export interface DataSourceInfo {
  label: string;
  description: string;
  /** Snapshot indicator: one TIME_PERIOD (the publication vintage) holding period averages. */
  defaultIndicator: string;
  recoveryIndicator: string;
  /** Annual series behind the snapshot. */
  defaultHistory: string;
  recoveryHistory: string;
  /** First year covered by the GEMs statistics for this segment. */
  coverageStart: number;
}

export const DATA_SOURCE_INFO: Record<DataSource, DataSourceInfo> = {
  sovereign: {
    label: 'Sovereign',
    description: 'sovereign and sovereign-guaranteed counterparts',
    defaultIndicator: 'IFC_GEM_SD',
    recoveryIndicator: 'IFC_GEM_SR',
    defaultHistory: 'IFC_GEM_SD_H',
    recoveryHistory: 'IFC_GEM_SR_H',
    coverageStart: 1984,
  },
  public: {
    label: 'Public sector',
    description: 'sub-sovereign public sector lending (public entities, state-owned enterprises)',
    defaultIndicator: 'IFC_GEM_PBD',
    recoveryIndicator: 'IFC_GEM_PBR',
    defaultHistory: 'IFC_GEM_PBD_H',
    recoveryHistory: 'IFC_GEM_PBR_H',
    coverageStart: 1994,
  },
  private: {
    label: 'Private sector',
    description: 'private sector lending (corporates, financial institutions, projects)',
    defaultIndicator: 'IFC_GEM_PRD',
    recoveryIndicator: 'IFC_GEM_PRR',
    defaultHistory: 'IFC_GEM_PRD_H',
    recoveryHistory: 'IFC_GEM_PRR_H',
    coverageStart: 1994,
  },
};

// Data360 uses WLD for the global aggregate; `_T` is not a REF_AREA code.
export const REGIONS = {
  'global': 'WLD',
  'east-asia': 'EAS',
  'europe-central-asia': 'ECS',
  'latin-america': 'LCN',
  'mena': 'MEA',
  'south-asia': 'SAS',
  'sub-saharan-africa': 'SSF',
} as const;

// World Bank income classification of the counterpart's country.
export const INCOME_GROUPS = {
  'high-income': 'HIC',
  'upper-middle-income': 'UMC',
  'lower-middle-income': 'LMC',
  'low-income': 'LIC',
} as const;

export const AREAS = { ...REGIONS, ...INCOME_GROUPS };
export type Area = keyof typeof AREAS;
export const AREA_KEYS = Object.keys(AREAS) as [Area, ...Area[]];

export const AREA_NAMES: Record<string, string> = {
  WLD: 'Global Emerging Markets',
  EAS: 'East Asia & Pacific',
  ECS: 'Europe & Central Asia',
  LCN: 'Latin America & Caribbean',
  MEA: 'Middle East, North Africa, Afghanistan & Pakistan',
  SAS: 'South Asia',
  SSF: 'Sub-Saharan Africa',
  HIC: 'High income',
  UMC: 'Upper middle income',
  LMC: 'Lower middle income',
  LIC: 'Low income',
};

// Countries with GEMs statistics on Data360 (2025 vintage), named as in the IFC_GEM REF_AREA dimension.
// Country data is published for private sector (90 countries) and public sector (14); none for sovereign.
export const COUNTRY_NAMES: Record<string, string> = {
  ALB: 'Albania', ARG: 'Argentina', ARM: 'Armenia', AZE: 'Azerbaijan', BEN: 'Benin', BFA: 'Burkina Faso',
  BGD: 'Bangladesh', BGR: 'Bulgaria', BIH: 'Bosnia and Herzegovina', BLR: 'Belarus', BOL: 'Bolivia',
  BRA: 'Brazil', CHL: 'Chile', CHN: 'China', CIV: 'Côte d’Ivoire', CMR: 'Cameroon', COD: 'Congo, Dem. Rep.',
  COL: 'Colombia', CRI: 'Costa Rica', CZE: 'Czechia', DOM: 'Dominican Republic', ECU: 'Ecuador',
  EGY: 'Egypt, Arab Rep.', GAB: 'Gabon', GEO: 'Georgia', GHA: 'Ghana', GIN: 'Guinea', GTM: 'Guatemala',
  HND: 'Honduras', HRV: 'Croatia', HTI: 'Haiti', HUN: 'Hungary', IDN: 'Indonesia', IND: 'India',
  JAM: 'Jamaica', JOR: 'Jordan', KAZ: 'Kazakhstan', KEN: 'Kenya', KGZ: 'Kyrgyz Republic', KHM: 'Cambodia',
  LBN: 'Lebanon', LKA: 'Sri Lanka', MAR: 'Morocco', MDA: 'Moldova', MDG: 'Madagascar', MEX: 'Mexico',
  MKD: 'North Macedonia', MLI: 'Mali', MMR: 'Myanmar', MNE: 'Montenegro', MNG: 'Mongolia', MOZ: 'Mozambique',
  MUS: 'Mauritius', MWI: 'Malawi', NGA: 'Nigeria', NIC: 'Nicaragua', NPL: 'Nepal', PAK: 'Pakistan',
  PAN: 'Panama', PER: 'Peru', PHL: 'Philippines', POL: 'Poland', PRY: 'Paraguay', PSE: 'West Bank and Gaza',
  ROU: 'Romania', RUS: 'Russian Federation', RWA: 'Rwanda', SEN: 'Senegal', SLV: 'El Salvador', SRB: 'Serbia',
  SVK: 'Slovak Republic', SVN: 'Slovenia', TGO: 'Togo', THA: 'Thailand', TJK: 'Tajikistan', TKM: 'Turkmenistan',
  TTO: 'Trinidad and Tobago', TUN: 'Tunisia', TUR: 'Türkiye', TZA: 'Tanzania', UGA: 'Uganda', UKR: 'Ukraine',
  URY: 'Uruguay', UZB: 'Uzbekistan', VEN: 'Venezuela, RB', VNM: 'Vietnam', XKX: 'Kosovo', ZAF: 'South Africa',
  ZMB: 'Zambia', ZWE: 'Zimbabwe',
};

// Common names that are not substrings of the codelist names.
const COUNTRY_ALIASES: Record<string, string> = {
  'turkey': 'TUR', 'ivory coast': 'CIV', 'russia': 'RUS', 'viet nam': 'VNM',
  'drc': 'COD', 'dr congo': 'COD', 'democratic republic of the congo': 'COD', 'kyrgyzstan': 'KGZ',
  'palestine': 'PSE', 'slovakia': 'SVK', 'czech republic': 'CZE', 'macedonia': 'MKD', 'burma': 'MMR',
};

const normalize = (name: string) =>
  name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

export type CountryMatch = { code: string } | { error: string };

/**
 * Resolve an ISO3 code or English country name to a REF_AREA code. Any three-letter input is taken as ISO3
 * (no country name has three letters), so countries added in later vintages stay reachable by code.
 * Names match exactly, by alias, or as whole words of the codelist name ("Egypt", "Bosnia").
 */
export function resolveCountry(input: string): CountryMatch {
  const trimmed = input.trim();
  const query = normalize(trimmed);
  if (COUNTRY_ALIASES[query]) return { code: COUNTRY_ALIASES[query] };
  if (/^[A-Za-z]{3}$/.test(trimmed)) return { code: trimmed.toUpperCase() };
  if (!query) return { error: 'Empty country name' };

  const entries = Object.entries(COUNTRY_NAMES).map(([code, name]) => [code, normalize(name)] as const);
  const exact = entries.find(([, name]) => name === query);
  if (exact) return { code: exact[0] };
  const words = entries.filter(([, name]) => ` ${name} `.includes(` ${query} `));
  if (words.length === 1) return { code: words[0][0] };
  if (words.length > 1) {
    return { error: `"${input}" matches several countries: ${words.map(([c]) => `${COUNTRY_NAMES[c]} (${c})`).join(', ')}` };
  }
  return { error: `Unknown country "${input}". Use an ISO3 code (e.g. KEN) or an English country name.` };
}

export const SECTORS = {
  'all': '_T',
  'overall': '_T',
  // IFC categories
  'non-financial': 'NF',
  'financial-institutions': 'FI',
  'banking': 'BK',
  'infrastructure': 'IN',
  'non-banking': 'NB',
  'renewables': 'R',
  'services': 'S',
  // GICS sectors
  'financials': 'F',
  'utilities': 'U',
  'industrials': 'I',
  'consumer-staples': 'CST',
  'consumer-discretionary': 'CD',
  'materials': 'M',
  'others': 'O',
  'communication-services': 'CS',
  'health-care': 'HC',
  'energy': 'E',
  'real-estate': 'RE',
  'information-technology': 'IT',
  'administration': 'A',
  'mixed': 'MXS',
} as const;
export type Sector = keyof typeof SECTORS;
export const SECTOR_KEYS = Object.keys(SECTORS) as [Sector, ...Sector[]];

export const SECTOR_NAMES: Record<string, string> = {
  _T: 'All sectors',
  NF: 'Non-financial institutions',
  FI: 'Financial Institutions',
  BK: 'Banking',
  IN: 'Infrastructure',
  NB: 'Non-banking financial institutions',
  R: 'Renewables',
  S: 'Services',
  F: 'GICS: Financials',
  U: 'GICS: Utilities',
  I: 'GICS: Industrials',
  CST: 'GICS: Consumer staples',
  CD: 'GICS: Consumer discretionary',
  M: 'GICS: Materials',
  O: 'GICS: Others',
  CS: 'GICS: Communication services',
  HC: 'GICS: Health Care',
  E: 'GICS: Energy',
  RE: 'GICS: Real Estate',
  IT: 'GICS: Information technology',
  A: 'GICS: Administration',
  MXS: 'Mixed',
};

export const PROJECT_TYPES = {
  'all': '_T',
  'overall': '_T',
  'corporate-finance': 'CF',
  'project-finance': 'PF',
  'financial-institutions': 'FI',
  'structured-finance': 'SF',
  'real-estate': 'RE',
  'other': 'O',
} as const;
export type ProjectType = keyof typeof PROJECT_TYPES;
export const PROJECT_TYPE_KEYS = Object.keys(PROJECT_TYPES) as [ProjectType, ...ProjectType[]];

export const PROJECT_TYPE_NAMES: Record<string, string> = {
  _T: 'All project types',
  CF: 'Corporate Finance',
  PF: 'Project Finance',
  FI: 'Financial Institutions',
  SF: 'Structured Finance',
  RE: 'Real Estate Finance',
  O: 'Other',
};

export const SENIORITY_NAMES: Record<string, string> = {
  _T: 'All seniority levels',
  SS: 'Senior-Secured',
  SU: 'Senior-Unsecured',
  S: 'Senior',
  SUB: 'Subordinated',
  NAV: 'Not Available',
};

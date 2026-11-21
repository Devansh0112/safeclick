// One place to rename the project. Change `name` and everything in the UI follows.
// (Also update "name" in package.json and the README heading.)
export const SITE = {
  name: 'SafeClick',
  tagline: 'Spot the scam. Keep your cool. Stay safe online.',
  description:
    'Free, open source, playful lessons that help people of all ages stay safe online and avoid scams.',
  repoUrl: 'https://github.com/YOUR-ORG/safeclick',
  codeLicense: 'MIT',
  contentLicense: 'CC BY 4.0',
  contentLicenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
} as const;

export const AGE_LEVELS = ['kids', 'everyone', 'builders'] as const;
export type AgeLevel = (typeof AGE_LEVELS)[number];

export const AGE_LABELS: Record<AgeLevel, string> = {
  kids: 'Kids',
  everyone: 'Everyone',
  builders: 'Builders',
};

// localStorage keys. Progress and preferences only. Never personal data.
export const STORAGE_KEYS = {
  age: 'sc-age',
  textSize: 'sc-text-size',
  contrast: 'sc-contrast',
  progress: 'sc-progress',
} as const;

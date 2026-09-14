/**
 * EVERY WORD ON THE PUBLIC WEBSITE, LISTED ONCE.
 *
 * The Website screens read this list to draw their boxes, and the tests read it
 * to check that every box the panel offers is one the server actually saves.
 * Two copies of this list is how a box ends up doing nothing.
 *
 * `max` must match the server's limit in routers/admin_settings.py. The panel
 * checking first is a courtesy - it lets somebody see the problem while they
 * are typing instead of after pressing Save. The server checking is the rule.
 */
export type WebsiteField = {
  /** The column name, which is also what the server expects in the save. */
  key: string;
  label: string;
  hint: string;
  max: number;
  /** A long box instead of a single line. */
  long?: boolean;
  /** Must start with https:// - checked here and again on the server. */
  link?: boolean;
  /** Picked from this computer with the picture chooser, not typed into a box. */
  picture?: boolean;
  /** A colour, picked from the swatches or the colour wheel. Must be written
   *  as # and three or six letters and numbers - checked here and again on the
   *  server, because it ends up inside a stylesheet on a public page. */
  colour?: boolean;
};

export const FRONT_PAGE_FIELDS: WebsiteField[] = [
  {
    key: "site_logo_url",
    label: "The Takal logo",
    hint: "Shown at the top and the bottom of the website. A PNG with a see-through background works best.",
    max: 500,
    link: true,
    /** Chosen from this computer, not typed. See parts-logo-picker.tsx. */
    picture: true,
  },
  {
    key: "site_topbar_colour",
    label: "The colour of the bar at the top",
    hint: "The bar with the logo and the Get the app button. Leave it empty for Takal yellow.",
    max: 7,
    /** Picked, not typed. See parts-colour-picker.tsx. */
    colour: true,
  },
  {
    key: "site_headline",
    label: "The big line",
    hint: "The first thing anybody reads. Keep it short.",
    max: 120,
  },
  {
    key: "site_headline_accent",
    label: "The word under it",
    hint: "This word gets the yellow marker under it. One or two words works best.",
    max: 60,
  },
  {
    key: "site_subline",
    label: "The sentence underneath",
    hint: "One or two lines saying what people can order and how fast it comes.",
    max: 400,
    long: true,
  },
  {
    key: "site_live_line",
    label: "The little green line at the top",
    hint: "The small pill with the green dot, for example: Now delivering in Mingora.",
    max: 80,
  },
  {
    key: "site_promise",
    label: "The delivery promise",
    hint: "Shown next to the clock, for example: 15-45 minutes.",
    max: 60,
  },
];

export const AREA_FIELDS: WebsiteField[] = [
  {
    key: "site_town",
    label: "Main town",
    hint: "The town the delivery circle is measured from.",
    max: 60,
  },
  {
    key: "site_areas",
    label: "Nearby places",
    hint: "Shown as small buttons under the map. Separate them with commas, for example: Mingora, Saidu Sharif, Kanju.",
    max: 400,
    long: true,
  },
];

export const LINK_FIELDS: WebsiteField[] = [
  {
    key: "site_email",
    label: "Public support address",
    hint: "Shown at the bottom of the website, where customers write to you.",
    max: 120,
  },
  {
    key: "site_play_url",
    label: "Google Play link",
    hint: "Where the Google Play button goes. Must start with https://",
    max: 500,
    link: true,
  },
  {
    key: "site_app_url",
    label: "App Store link",
    hint: "Where the App Store button goes. Must start with https://",
    max: 500,
    link: true,
  },
];

/** Every field on every Website screen. Used by the tests. */
export const ALL_WEBSITE_FIELDS: WebsiteField[] = [
  ...FRONT_PAGE_FIELDS,
  ...AREA_FIELDS,
  ...LINK_FIELDS,
];

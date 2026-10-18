/**
 * Who to contact, in their own words, with the page and the day it was read.
 *
 * The guidance content register (task W4.2) in the form the screens can read.
 * Every channel here carries the sentence it came from, the publisher, the
 * page and the date, because AC 6.3.2 asks for an official channel rather than
 * a plausible one and the Epic 6 definition of done asks for each to be
 * traceable. **Nothing in this file is a channel this project invented**, and
 * the quotes are what a reviewer checks it against.
 *
 * Read on 3 October 2026.
 *
 * **Two things deliberately left out.** Response times, which three of these
 * pages publish and AC 6.3.2 forbids repeating: a page that says when somebody
 * will come is making a promise this project cannot keep. And any suggestion
 * of what will be done about the problem, for the same reason.
 *
 * **The plumbing regulator changed its name.** The Victorian Building
 * Authority is now the Building and Plumbing Commission, and its pages
 * redirect to `bpc.vic.gov.au`. The new name is what a reader will see when
 * they follow the link, so it is the name here.
 */

/** One official way to reach one organisation. */
export interface Channel {
  readonly organisation: string;
  /** What the reader does, as the page describes it. */
  readonly action: string;
  /** The page to open, where the channel is a form or a directory. */
  readonly href?: string;
  /** The number to ring, where the channel is a telephone call. */
  readonly phone?: string;
  /** The sentence it was taken from, for the register and for review. */
  readonly quote: string;
  readonly publisher: string;
  readonly page: string;
  /** When the page was read, `YYYY-MM-DD`. */
  readonly checked: string;
}

const READ_ON = '2026-10-03';

/** The council's own reporting form for a drain in a public street. */
export const COUNCIL_FORM: Channel = {
  organisation: 'City of Melbourne',
  action: 'Report a maintenance issue online',
  href: 'https://www.melbourne.vic.gov.au/street-cleaning-and-maintenance',
  quote:
    'City of Melbourne is responsible for the management and maintenance of our stormwater system. These include the kerb and channels (gutters), open channels, underground drains, pits located in public roads and our drains in drainage easements.',
  publisher: 'City of Melbourne',
  page: 'https://www.melbourne.vic.gov.au/stormwater',
  checked: READ_ON,
};

/** The council's number for anything that cannot wait for a form. */
export const COUNCIL_URGENT: Channel = {
  organisation: 'City of Melbourne',
  action: 'Call straight away if there is danger to the public',
  phone: '03 9658 9658',
  quote:
    'If there is any danger to the public or public space, call us straight away on 03 9658 9658.',
  publisher: 'City of Melbourne',
  page: 'https://www.melbourne.vic.gov.au/street-cleaning-and-maintenance',
  checked: READ_ON,
};

/** Melbourne Water, for the drains and waterways the council does not hold. */
export const MELBOURNE_WATER: Channel = {
  organisation: 'Melbourne Water',
  action: 'Call or use the online enquiry form',
  href: 'https://www.melbournewater.com.au/about/contact-us',
  phone: '131 722',
  quote:
    'To report smell, pollution or another urgent issue relating to one of our sites, please call us directly on 131 722 at any time.',
  publisher: 'Melbourne Water',
  page: 'https://www.melbournewater.com.au/about/contact-us',
  checked: READ_ON,
};

/** A licensed plumber, for anything on the reader's own side of the boundary. */
export const LICENSED_PLUMBER: Channel = {
  organisation: 'A licensed plumber',
  action: 'Find and check a practitioner in the regulator’s directory',
  href: 'https://www.bpc.vic.gov.au/find-and-check-a-practitioner',
  quote:
    'Make sure you engage a licensed or registered plumber when you want plumbing work carried out.',
  publisher: 'Building and Plumbing Commission',
  page: 'https://www.bpc.vic.gov.au/home-owners/before-you-start-building/engaging-a-plumber',
  checked: READ_ON,
};

/** VICSES, for flood and storm assistance. */
export const VICSES: Channel = {
  organisation: 'Victoria State Emergency Service',
  action: 'Call for emergency flood or storm assistance',
  phone: '132 500',
  quote: 'Call 132 500 for emergency assistance from VICSES.',
  publisher: 'Victoria State Emergency Service',
  page: 'https://www.ses.vic.gov.au/plan-and-stay-safe/emergencies/flood',
  checked: READ_ON,
};

/** Triple Zero, which comes before everything else here. */
export const TRIPLE_ZERO: Channel = {
  organisation: 'Emergency services',
  action: 'Call in a life-threatening emergency',
  phone: '000',
  quote: 'Call Triple Zero (000) in life-threatening emergencies',
  publisher: 'Victoria State Emergency Service',
  page: 'https://www.ses.vic.gov.au/plan-and-stay-safe/emergencies/flood',
  checked: READ_ON,
};

/** Every channel, for the register and for the check that holds them. */
export const CHANNELS: readonly Channel[] = [
  COUNCIL_FORM,
  COUNCIL_URGENT,
  MELBOURNE_WATER,
  LICENSED_PLUMBER,
  VICSES,
  TRIPLE_ZERO,
];

/** How a channel reads on one line: *Melbourne Water · 131 722*. */
export function channelLine(channel: Channel): string {
  const how = channel.phone === undefined ? channel.action : `${channel.action} on ${channel.phone}`;
  return `${channel.organisation} · ${how}`;
}

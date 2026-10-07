/**
 * What *Ask about getting ready* is allowed to say, and where every word of
 * it came from.
 *
 * Epic 5's assistant, from the team's Figma (file `atD5fleOrhvMjJ5m0pXYGt`,
 * *Epic 5 · AI: Ask about getting ready*, AI1 and Q0 to Q5). The design shows
 * a panel that answers questions about preparing for heavy rain, with a
 * source chip under every answer, a state for questions it cannot answer, and
 * a state for an emergency.
 *
 * **Nothing here is generated.** The repository carries a retrieval prototype
 * under `assistant/` -- Streamlit, ChromaDB and a model running under Ollama
 * on one person's machine -- and it is not deployed, not reachable from the
 * product, and not what this reads. A language model in the browser would put
 * the project's name on sentences nobody approved, about floodwater, for
 * readers who are not in a position to check them. So the panel answers from
 * a register: a fixed set of answers, each one written from sentences on an
 * official page, each one carrying those sentences so a reviewer can hold the
 * answer against the source rather than against somebody's memory of it.
 *
 * **The register is bounded by the Stage 2 evaluation.** `evaluated` names
 * the rows of `assistant/evaluation_results.csv` -- the thirty questions a
 * person scored by hand, with the document and page they checked -- that this
 * answer covers. An answer ships only where that evaluation found the
 * question answerable from official guidance, which is why there is no answer
 * about repair costs, insurers, or whether a particular house will flood: the
 * evaluation calls those unanswerable and `respond.ts` refuses them by name.
 *
 * **Why the sources are pages and not the PDFs the evaluation cites.** The
 * evaluation checked nine PDFs, and every one of them is recorded in
 * `assistant/sources.csv` as *no open licence identified*. The bullets below
 * are written from the publishers' own web pages instead, read on the date
 * each source carries, because a page this project can quote and a reader can
 * open is worth more than a page number out of a document neither of them is
 * licensed to reproduce.
 */

/** One official page an answer was written from. */
export interface AskSource {
  readonly publisher: string;
  /** What the chip shows after the publisher, as the page titles itself. */
  readonly document: string;
  readonly href: string;
  /** The sentence the answer was written from, for the register and review. */
  readonly quote: string;
  /** When the page was read, `YYYY-MM-DD`. */
  readonly checked: string;
}

/** One answer the panel is allowed to give. */
export interface AskAnswer {
  readonly id: string;
  /** The question as the suggested chip asks it, and the panel echoes back. */
  readonly question: string;
  /** The line before the points, as the design writes it. */
  readonly intro: string;
  readonly points: readonly string[];
  readonly sources: readonly AskSource[];
  /** Rows of the Stage 2 evaluation this answer covers. */
  readonly evaluated: readonly string[];
  /**
   * The plan action this answer is already about, or `null`.
   *
   * The design shows *In your plan: Keep an emergency kit ready ›* under an
   * answer. It is a link to something the plan already lists, not a way of
   * adding one -- the plan's general actions are their own register and an
   * answer may not grow it (AC 5.2.3). Most answers have no such line,
   * because most of what a reader can ask about is not one of the three.
   */
  readonly planAction: string | null;
  /**
   * The words that select this answer.
   *
   * Deliberately narrow and deliberately disjoint: no word here appears in
   * another answer's list, and no word here is one that any question about
   * flooding carries anyway -- *flood*, *water*, *house*, *storm*, *rain*.
   * A vocabulary of common words would answer every question with whichever
   * entry happened to be first, which is the failure this panel most needs
   * not to have. `respond.test.ts` holds both properties.
   */
  readonly words: readonly string[];
}

const VICSES_FLOOD = {
  publisher: 'VICSES',
  document: 'Flood — plan and stay safe',
  href: 'https://www.ses.vic.gov.au/plan-and-stay-safe/emergencies/flood',
  checked: '2026-10-08',
} as const;

const VICSES_STORM = {
  publisher: 'VICSES',
  document: 'Storm — plan and stay safe',
  href: 'https://www.ses.vic.gov.au/plan-and-stay-safe/emergencies/storm',
  checked: '2026-10-02',
} as const;

const MELBOURNE_WATER = {
  publisher: 'Melbourne Water',
  document: 'Prepare for flooding',
  href: 'https://www.melbournewater.com.au/water-and-environment/flooding-and-drainage/prepare-flooding',
  checked: '2026-10-08',
} as const;

export const ANSWERS: readonly AskAnswer[] = [
  {
    id: 'gutters',
    question: 'How do I clean gutters and drains safely?',
    intro: 'Official guidance is to clear them before rain, not during it:',
    points: [
      'Clear leaves and debris out of gutters, downpipes and drains.',
      'Do it while the weather is fine. Never clear a drain in heavy rain.',
      'If it means a ladder in wind or rain, it can wait.',
    ],
    sources: [
      {
        ...MELBOURNE_WATER,
        quote: 'Clear debris from gutters and drains.',
      },
      {
        ...VICSES_STORM,
        quote: 'Clean your gutters, downpipes and drains to ensure they are not blocked.',
      },
    ],
    evaluated: ['Q7'],
    planAction: 'gutters',
    words: ['gutter', 'gutters', 'downpipe', 'downpipes', 'debris', 'leaves', 'ladder'],
  },
  {
    id: 'water-out',
    question: 'What can I do to keep water out of my home?',
    intro: 'Three things the guides name, in the order they are usually done:',
    points: [
      'Seal cracks or gaps in the foundations.',
      'Check that you have sandbags, or know where to get them.',
      'Block drains, toilets and doorways if water is expected inside.',
    ],
    sources: [
      {
        ...MELBOURNE_WATER,
        quote: "Seal any cracks or gaps in your home's foundations.",
      },
      {
        ...MELBOURNE_WATER,
        quote: 'Check that you have sandbags or know where to get them.',
      },
      {
        ...VICSES_FLOOD,
        quote: 'Block it: Block drains, toilets, and doorways',
      },
    ],
    evaluated: ['Q1'],
    planAction: null,
    words: [
      'sandbag',
      'sandbags',
      'crack',
      'cracks',
      'gaps',
      'seal',
      'doorway',
      'doorways',
      'toilets',
      // *Entering* belongs here and not to the emergency phrases, which are
      // about a house water is already in: `respond()` reads those first, so
      // "entering my house right now" is still three telephone numbers.
      'entering',
      'reduce',
    ],
  },
  {
    id: 'valuables',
    question: 'What should I do with valuable things in the house?',
    intro: 'Height is the whole of it:',
    points: [
      'Lift valuables up high.',
      'Keep power points, switchboards, electronics, appliances and furniture above the floodwater levels expected for your area.',
    ],
    sources: [
      {
        ...VICSES_FLOOD,
        quote: 'Lift it: Lift your valuables up high',
      },
      {
        ...MELBOURNE_WATER,
        quote:
          'Make sure power points, switchboards, electronics, appliances and furniture are positioned above expected floodwater levels.',
      },
    ],
    evaluated: ['Q5'],
    planAction: null,
    words: ['valuables', 'valuable', 'furniture', 'appliances', 'electronics', 'switchboard', 'lift'],
  },
  {
    id: 'documents',
    question: 'How should I keep documents and photographs safe?',
    intro: 'Waterproof, or not on paper at all:',
    points: [
      'Put important documents and valuables in waterproof containers.',
      'Or make digital copies of them.',
      'Keep a copy of your insurance policy somewhere secure that you can still reach.',
    ],
    sources: [
      {
        ...MELBOURNE_WATER,
        quote:
          'Store important documents and valuables in waterproof containers, or create digital backups.',
      },
      {
        ...MELBOURNE_WATER,
        quote: 'Store copies of your insurance documents in a secure, accessible location.',
      },
    ],
    evaluated: ['Q4'],
    planAction: null,
    words: ['document', 'documents', 'papers', 'passport', 'photographs', 'backups', 'waterproof'],
  },
  {
    id: 'insurance',
    question: 'What should I check in my insurance?',
    intro: 'Two things, and both are about the policy you already have:',
    points: [
      'Check whether it covers flood and stormwater damage.',
      'Read the exclusions and limits, so you know what it does not cover.',
    ],
    sources: [
      {
        ...MELBOURNE_WATER,
        quote:
          'Check if your home insurance policy covers flood and stormwater damage, and make sure you understand any exclusions or limitations.',
      },
    ],
    evaluated: ['Q3'],
    planAction: null,
    words: ['insurance', 'insured', 'policy', 'premium', 'excess', 'cover', 'covered'],
  },
  {
    id: 'kit',
    question: 'What goes in an emergency kit?',
    intro: 'Official guides describe a kit that lasts three days:',
    points: [
      'Enough essentials for three days, in case the power goes out or you have to leave.',
      'Medications, spare clothes, a mobile phone, and anything your pets need.',
      'An emergency plan written down, with the contact details that matter.',
      'VICSES publishes checklists and templates you can fill in.',
    ],
    sources: [
      {
        ...MELBOURNE_WATER,
        quote:
          "Pack an emergency flood kit with at least three days' worth of essentials, in case you lose power or need to evacuate.",
      },
      {
        ...VICSES_FLOOD,
        quote: 'Remember to take your pets, mobile phone, spare clothes, mask and medications.',
      },
      {
        ...MELBOURNE_WATER,
        quote:
          'Create an emergency plan for your home or business to record key contact details and other important information.',
      },
    ],
    evaluated: ['Q10'],
    planAction: null,
    words: ['kit', 'pack', 'packed', 'essentials', 'supplies', 'medications', 'pets'],
  },
  {
    id: 'leaving',
    question: 'What should I do if I have to leave?',
    intro: 'Leave early, and before you go:',
    points: [
      'Turn off the gas and electricity.',
      'Go to family or friends somewhere safe, away from the flooding.',
      'Check for road closures on the way, and follow what emergency services tell you.',
      'Wait for official clearance before you come back.',
    ],
    sources: [
      {
        ...VICSES_FLOOD,
        quote: 'Turn off gas and electricity at your home or workplace.',
      },
      {
        ...VICSES_FLOOD,
        quote:
          'Travel to the home of family or friends who are in a safe location, away from flooding.',
      },
      {
        ...MELBOURNE_WATER,
        quote:
          "Evacuate early if you're told to, and wait for official clearance before returning home.",
      },
    ],
    evaluated: ['Q10'],
    planAction: null,
    words: ['evacuate', 'evacuation', 'leave', 'leaving', 'gas', 'electricity', 'closures'],
  },
  {
    id: 'car',
    question: 'How can I protect my car?',
    intro: 'Where it is parked, and where it is never driven:',
    points: [
      'Park under cover, or away from trees.',
      'Never drive, ride or walk through floodwater.',
      'As little as 15 cm of water can float a small car.',
    ],
    sources: [
      {
        ...VICSES_STORM,
        quote: 'Park your car under cover or away from trees.',
      },
      {
        ...VICSES_FLOOD,
        quote: 'Never drive, ride or walk through floodwater',
      },
      {
        ...MELBOURNE_WATER,
        quote: 'Never drive through floodwater – just 15cm of water can float a small car',
      },
    ],
    evaluated: ['Q12'],
    planAction: 'parking',
    words: ['car', 'cars', 'vehicle', 'parked', 'parking', 'garage', 'driveway'],
  },
  {
    id: 'warnings',
    question: 'Where do I find current warnings?',
    intro: 'Not here. DrainLens is not a warning service, and these are:',
    points: [
      'VicEmergency — website, app, or the hotline on 1800 226 226.',
      'Set the warning settings in the VicEmergency app for where you live.',
      'Weather warnings and forecasts come from the Bureau of Meteorology.',
    ],
    sources: [
      {
        ...VICSES_FLOOD,
        quote:
          'Stay informed – monitor weather warnings and forecasts at the Bureau of Meteorology website, and warnings through the VicEmergency app, website and hotline (1800 226 226).',
      },
      {
        ...MELBOURNE_WATER,
        quote: 'Download the VicEmergency App and set your warning settings.',
      },
    ],
    evaluated: ['Q6'],
    planAction: null,
    words: ['warning', 'warnings', 'alert', 'alerts', 'vicemergency', 'forecast', 'notified'],
  },
  {
    id: 'local-risk',
    question: 'How do I find out about flooding in my suburb?',
    intro: 'VICSES publishes a guide for the places that have one:',
    points: [
      'Check whether your suburb has a VICSES Local Flood Guide.',
      'Kensington, North Melbourne, West Melbourne, the CBD and Southbank each have one.',
      'A Local Flood Guide is about the suburb, not about one address.',
    ],
    sources: [
      {
        ...MELBOURNE_WATER,
        quote: 'Check if your suburb has a VICSES Local Flood Guide.',
      },
      {
        ...VICSES_FLOOD,
        quote: 'Local flood information for your area',
      },
    ],
    evaluated: ['Q13', 'Q17'],
    planAction: null,
    words: ['suburb', 'area', 'local', 'guide', 'guides', 'neighbourhood', 'risk', 'affect'],
  },
];

/** The heading over the panel, and the back link to the plan (Figma Q0). */
export const ASK_HEADING = 'Ask about getting ready';
export const BACK_TO_PLAN = 'Back to my plan';

/** The way in, at the foot of the plan (Figma AI1). */
export const ASK_PROMPT = 'Have a question about getting ready?';
export const ASK_LINK = 'Ask';

/** What the panel says about itself, above everything else (Figma Q0). */
export const ASK_NOTE =
  'Answers come from official guides by VICSES, Melbourne Water and the City of Melbourne. This is not a flood warning.';

/** Over the suggested questions. */
export const BASED_ON_YOUR_PLAN = 'BASED ON YOUR PLAN';

/** The placeholder and the line under the box (Figma Q0). */
export const ASK_PLACEHOLDER = 'Ask your question…';
export const ASK_PRIVACY =
  "Please don't type personal details. Your address is not sent with your question.";

/** While an answer is being found (Figma Q1). */
export const FINDING_ANSWER = 'Finding an answer in the official guides…';

/** The line over the plan link under an answer (Figma Q2). */
export const IN_YOUR_PLAN = 'In your plan:';

/**
 * The four questions the panel offers before anybody types (Figma Q0).
 *
 * The design picks these four, and they are the four it picks. Each is an
 * answer's own `question`, so a chip can never offer something the register
 * cannot answer -- `respond.test.ts` holds that.
 */
export const SUGGESTED: readonly string[] = ['gutters', 'kit', 'car', 'warnings'];

/** An answer by id, or `null` where nothing carries that id. */
export function answerFor(id: string): AskAnswer | null {
  return ANSWERS.find((answer) => answer.id === id) ?? null;
}

/**
 * What the panel says when it will not answer (Figma Q4).
 *
 * The design writes one of these, for the question it expects most: *will my
 * house flood in the next storm?* The other three are the other things the
 * Stage 2 evaluation calls unanswerable, and they get their own first
 * sentence because a question about a repair bill answered with *we cannot
 * tell whether a specific home will flood* is a true sentence about a
 * question nobody asked.
 *
 * All four end in the same place, which is the point of the state: the panel
 * cannot answer, and here are the two things that can.
 */
export const CANNOT_SAY: Readonly<Record<string, string>> = {
  prediction:
    "The official guides can't tell whether a specific home will flood, and DrainLens doesn't predict flooding.",
  cost: "The official guides don't cover what flood damage costs to repair, and DrainLens doesn't estimate it.",
  provider:
    "The official guides don't recommend one insurer or policy over another, and neither does DrainLens.",
  inspection:
    "Nobody can check the state of your home from here. If something looks unsafe, ask a licensed tradesperson.",
  'not-covered': "That isn't in the official guides this panel reads.",
};

/** The heading over the two things that can be done instead (Figma Q4). */
export const WHAT_YOU_CAN_DO = 'What you can do now:';

/**
 * The emergency card (Figma Q5).
 *
 * Three rows, biggest first, and the number is the thing the eye lands on.
 * The numbers are the ones the reporting pathway already publishes, and
 * `answers.test.ts` holds them against it: two places showing a different
 * emergency number is the failure that matters most in this whole product.
 */
export const EMERGENCY_TITLE = 'This sounds like an emergency';

export interface EmergencyRow {
  readonly what: string;
  readonly who: string;
  /** The number to call, or `null` where the row is a link instead. */
  readonly number: string | null;
}

export const EMERGENCY_ROWS: readonly EmergencyRow[] = [
  { what: 'Life in danger', who: 'Call Triple Zero', number: '000' },
  { what: 'Flood or storm help', who: 'VICSES', number: '132 500' },
  { what: 'Current warnings', who: 'VicEmergency', number: null },
];

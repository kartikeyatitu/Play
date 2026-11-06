// TRIQ Mind & Performance C1: static support information and shared safety copy.
//
// CONTACTS TO BE CONFIRMED BY THE CLINICAL ADVISOR BEFORE LAUNCH.
// Every number below must be checked against official sources by the clinical advisor (and
// counsel for UAE) before /mind is switched on in production. Do not add numbers without that check.

export const SAFETY_NOTE =
  "This is mental skills training for sport. It is not medical or psychological treatment, and it does not take the place of a doctor, psychologist or counsellor.";

export const SUPPORT_LINK_LABEL = "Need to talk to someone now?";
export const SUPPORT_PATH = "/mind/support";

export const CONTACTS_PENDING_NOTE = "Contacts to be confirmed by the clinical advisor before launch.";

export interface SupportContact {
  name: string;
  number: string;
  /** tel: value, digits only. */
  dial: string;
  detail: string;
}

export interface SupportRegion {
  id: string;
  region: string;
  contacts: SupportContact[];
}

export const SUPPORT_REGIONS: readonly SupportRegion[] = [
  {
    id: "india",
    region: "India",
    contacts: [
      { name: "Emergency services", number: "112", dial: "112", detail: "If someone is in immediate danger." },
      { name: "Tele-MANAS mental health helpline", number: "14416", dial: "14416", detail: "National mental health support line." },
    ],
  },
  {
    id: "uae",
    region: "United Arab Emirates",
    contacts: [{ name: "Emergency services", number: "999", dial: "999", detail: "If someone is in immediate danger." }],
  },
];

export const TRUSTED_ADULT_STEPS: readonly string[] = [
  "If you or someone else is in danger right now, call the emergency number for your country.",
  "Tell a trusted adult: a parent or guardian, another family member, a teacher, a coach, or a school counsellor.",
  "If the first person does not listen or help, keep telling other trusted adults until someone does.",
  "You do not have to have the right words. \"I'm not okay and I need help\" is enough.",
  "If you are worried about a friend, tell a trusted adult. That is not getting them in trouble; it is helping.",
];

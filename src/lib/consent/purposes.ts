// Consent purposes for the DPDP parental consent ledger (ConsentRecord, flag FEATURES.consentLedger).
// Pure module: safe to import from server and client code.
//
// COUNSEL: confirm the list of purposes, the notice wording for each and the notice version
// (TRIQ_DATA_PRIVACY.md section 5). The wording below is a plain-language draft, not reviewed text.

export const CONSENT_PURPOSES = [
  "CORE_SERVICE",
  "PROGRESS_SHARING",
  "AI_PROCESSING",
  "MEDIA_INTERNAL",
  "MEDIA_BATCH",
  "MEDIA_PUBLIC",
  "LEADERBOARDS",
  "MARKETING_TO_PARENT",
] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const isConsentPurpose = (v: unknown): v is ConsentPurpose =>
  typeof v === "string" && (CONSENT_PURPOSES as readonly string[]).includes(v);

/**
 * Version of the consent notice shown on /consent. A grant recorded under an older notice still
 * counts unless the caller asks for the current version (hasConsent's noticeVersion option).
 * COUNSEL: decide whether a notice change must force fresh consent for every purpose.
 */
export const CONSENT_NOTICE_VERSION = "2026-11-draft-1";

/**
 * How the guardian was verified for a ledger row: they are the guardian on the child's enrolment
 * record (Student.parentId or a GuardianLink) and confirmed with a one-time code sent to their phone.
 * COUNSEL: DPDP Rules, Rule 10 (verifiable consent of a parent for a child) asks the Data Fiduciary to
 * use due diligence to check that the person is an identifiable adult and the parent. Confirm whether
 * "enrolment record + phone OTP" meets that bar, or whether a government-ID / DigiLocker token or an
 * in-person check by the academy is also needed.
 */
export const CONSENT_METHOD_ENROLMENT_OTP = "enrolment+otp";

export interface PurposeInfo {
  label: string;
  /** Plain-language notice text shown to the guardian. */
  notice: string;
  /** Turning this off ends the academy relationship; the UI warns before recording it. */
  essential?: boolean;
}

export const PURPOSE_INFO: Record<ConsentPurpose, PurposeInfo> = {
  CORE_SERVICE: {
    label: "Running the academy",
    notice: "Attendance, fees, batches and progress notes the academy needs to coach your child.",
    essential: true,
  },
  PROGRESS_SHARING: {
    label: "Sharing progress",
    notice: "Sharing your child's progress reports beyond the academy, for example with a selector you choose.",
  },
  AI_PROCESSING: {
    label: "AI features",
    notice: "Including your child's coaching data in AI drafts and summaries. Names are removed where possible. Never used to train AI models.",
  },
  MEDIA_INTERNAL: {
    label: "Photos for coaches",
    notice: "Photos and videos of your child used only by coaches to give feedback.",
  },
  MEDIA_BATCH: {
    label: "Photos to batch parents",
    notice: "Photos and videos of your child shared with other parents in the same batch.",
  },
  MEDIA_PUBLIC: {
    label: "Public photos",
    notice: "Photos of your child on the academy's public page or social media. First name only.",
  },
  LEADERBOARDS: {
    label: "Leaderboards",
    notice: "Showing your child's first name and points on academy leaderboards.",
  },
  MARKETING_TO_PARENT: {
    label: "Offers to you",
    notice: "Messages to you (the parent) about camps, events and offers. Never sent to your child.",
  },
};

/**
 * COUNSEL: CORE_SERVICE may rest on the enrolment contract rather than consent. Until counsel says
 * otherwise it is recorded like every other purpose, and withdrawing it is recorded but does not by
 * itself stop the service; the academy follows up.
 */
export const CORE_SERVICE_NOTE =
  "Turning this off tells the academy you want to stop. They will contact you; it does not cancel enrolment on its own.";

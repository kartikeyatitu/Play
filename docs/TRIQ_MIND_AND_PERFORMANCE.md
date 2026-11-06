# TRIQ Mind & Performance

Date: 2026-11-06. Sources: master blueprint section 6, athlete flagship spec (Phase C), `docs/TRIQ_AUDIT.md` section 6.

**Status: Missing.** Nothing athlete-facing exists. This is a planned flagship vertical with release gates. It ships **content only** (no personal data) until counsel and a clinical advisor sign off (decision 2026-11-06, `TRIQ_DECISIONS.md`).

## 1. Purpose

Help athletes build the mental skills, resilience, confidence and wellbeing needed for long-term participation and performance. For amateur players, academy students, competitive and professional athletes, coaches and parents.

It is a dedicated vertical, not a field on the athlete profile.

Three rules:

1. **Wellbeing is not a performance score.** Nothing here is ranked, rewarded, scored or shown to opponents, selectors or sponsors.
2. **TRIQ teaches mental skills. Qualified professionals do clinical work.** TRIQ is not a diagnostic or treatment service.
3. **Never pressure disclosure.** No streaks, points, badges or nudges that push an athlete to share feelings.

Outside evidence: the founder's notes cite an IOC 2026 athlete mental-health consensus. **Unverified.** Do not cite it in product copy, pitches or this documentation until someone confirms the source and wording.

## 2. Mental performance profile

A private, athlete-owned profile that shows development over time. **It does not label athletes with personality scores.**

Areas the athlete may choose to reflect on: confidence, concentration, motivation, emotional regulation, performance anxiety, competitive pressure, resilience, self-belief, goal orientation, focus, decision-making, adaptability, team communication, recovery mindset, competitive readiness.

Rules:

- Entries are self-reflections and routine records, not test scores.
- No composite "mental score". No comparison with other athletes.
- Tier 2 data (see `TRIQ_DATA_PRIVACY.md`). Private by default.
- Status: **Planned (C2).** Needs counsel and clinical sign-off and the `care` schema.

## 3. Mental conditioning programmes

Structured, optional programmes written as skills training, not therapy.

| Programme | Content |
|---|---|
| Focus and concentration | Attention control, distraction management, focus routines, visual attention exercises, pre-performance routines |
| Confidence | Confidence-building exercises, self-efficacy, performance reflection, strength identification, preparation routines |
| Competitive anxiety | Pressure awareness, breathing, relaxation, visualisation, pre-match routines, competition preparation |
| Emotional regulation | Emotional awareness, frustration and anger management, handling mistakes, post-match reflection, healthy coping |
| Resilience | Handling defeat, managing expectations, recovering from setbacks, keeping motivation, responding to criticism, learning from performance |
| Motivation | Goal setting, habit formation, training consistency, long-term development |
| Team psychology | Communication, leadership, trust, cohesion, conflict management, shared goals |

Status: **Planned (C1)** for the content. Tracking a user's progress through a programme is tier 2 and waits for C2.

## 4. Match-day workspace

| When | Content (C1, no personal data) | Personal parts (C2, gated) |
|---|---|---|
| Before | Preparation routine templates, competition checklist, guided breathing, visualisation | Personal readiness check-in, focus goals, confidence reflection |
| During | Quick focus exercises, saved personal routines | Optional recovery break notes |
| After | Reflection templates, lessons-learned prompts | Match reflection, emotional check-in, next-session goals |

Coach communication on match day uses ordinary coaching channels (tier 1). It must not carry check-in content unless the athlete shares it.

**Mental-state information is never available to opponents, selectors or sponsors.**

## 5. Sport packs

Configurable sport templates, not one hard-coded model for every sport.

| Sport | Topics |
|---|---|
| Badminton and racket sports | Unforced errors, focus between rallies, confidence in close games, momentum, match-point pressure, recovering after losing a game |
| Cricket | Batting pressure, bowling under pressure, fielding concentration, decision-making, long-format endurance |
| Football | Team communication, decision-making, confidence after mistakes, match pressure, leadership |
| Basketball | Free-throw pressure, decision-making, focus, team confidence, momentum |
| Athletics | Pre-event preparation, race anxiety, self-belief, focus, recovery from disappointing results |
| Combat sports | Pre-competition preparation, emotional regulation, confidence, recovery from competition. Weight management only through qualified professionals |

Status: **Planned (C1).** Each pack needs sports-psychologist review before release.

## 6. Wellbeing support is different from performance coaching

| | Performance coaching | Wellbeing support |
|---|---|---|
| Goal | Build mental skills for sport | Support stress, burnout, anxiety symptoms, low mood, sleep concerns, loneliness, social pressure, bullying, discrimination, injury-related distress, retirement and transitions |
| Who delivers | TRIQ content, coaches trained in positive coaching | Qualified professionals only |
| Data | Content: none. Progress: tier 2 | Check-ins: tier 2. Professional records: tier 3 |
| Screening | Never | Validated tools only under professional governance |
| Release step | C1 | C2 and C3, gated |

Wellbeing capabilities (all **Planned**, gated): optional check-ins, confidential appointments, referrals to qualified professionals, emergency support pathways, consent management, private care records, follow-up workflows.

## 7. Professional services (C3)

A marketplace and workspace for qualified sports psychologists, then physiotherapists and nutritionists with their own boundaries.

Provider capabilities: profile, qualifications, experience, sport specialisations, languages, registration or credential checks, availability, bookings, secure communication, online and in-person consultations, service packages, session records, follow-up plans, feedback, payments.

Professional journey (blueprint section 17): profile → qualifications → verification → services → availability → packages → appointment requests → informed consent → confidential sessions → private records → follow-up → payment → business tracking.

Rules:

- A provider is shown as **verified** only after credential checks. Which registrations count (for example RCI registration for clinical psychologists in India) is **to be confirmed** with the advisory network.
- Informed consent is recorded per engagement.
- Clinical notes belong to the professional, live in the `care` schema, are encrypted, and are never visible to the academy, coach, selector or sponsor.

Builds on: `ProfessionalProfile`, `ProfessionalCredential`, `WellnessProvider`, `WellnessAppointment` (all Built, unused). Status: **Planned (C3).**

## 8. Parent and coach education

Part of C1. No personal data.

| Audience | Topics |
|---|---|
| Parents | Supporting young athletes, managing expectations, handling losses, avoiding excessive pressure, supporting motivation, recognising distress, encouraging healthy participation |
| Coaches | Positive coaching, communication, managing confidence, avoiding humiliation and abusive practices, handling mistakes, recognising burnout, supporting athletes after injury, knowing when to refer to a professional |

The athlete's environment is part of the product, not only the athlete.

## 9. Analytics limits

Allowed (private to the athlete, or to an authorised professional with consent): programme participation, routine consistency, self-reported confidence trends, focus routine completion, personal goals, session attendance, wellbeing check-in trends.

Platform-level metrics: aggregate, voluntary and professionally governed only (participation, service access, appointment completion, follow-up, education completion, referral responsiveness).

Never:

- Rank athletes by mental health, vulnerability or emotional state.
- Show any of this to coaches or academies by default.
- Feed it into levels, points, leaderboards, selection or sponsorship.
- Optimise for fewer distress reports or higher confidence scores.
- Send Mind & Performance pages to web analytics (child and family pages are already excluded; see `src/lib/analytics-privacy.ts`).

## 10. Safety boundaries

| Boundary | Rule |
|---|---|
| No AI diagnosis | AI never diagnoses depression, anxiety, eating disorders or any condition; never infers hidden psychological conditions; never provides psychotherapy; never replaces a psychologist |
| No prescriptions | No medication advice; no automated clinical dietary prescriptions |
| No return-to-play decisions | Only the responsible qualified professional decides. AI and coaches cannot clear an athlete |
| AI scope | Allowed: guided focus routines, general mental-skills education, reflection prompts, routine organisation, educational resources, appointment discovery |
| AI and entries | No AI reads wellbeing entries unless the athlete explicitly turns it on; entries are never used for model training |
| Risk language | A check-in or journal entry with risk language shows a supportive screen with crisis contacts and a way to reach a trusted adult or professional |
| Escalation | Emergency escalation protocols are set with qualified professionals and local services before C2 |
| Honest confidentiality | The product never promises confidentiality it cannot keep |

These are tested as refusal and behaviour cases before any AI feature touches this vertical.

## 11. Minors

| Age | Model |
|---|---|
| Under 13 | Guardian-led. Content and any check-ins designed for guardian use |
| 13 to 17 | Athlete-facing, with **guardian consent and the athlete's own assent** |
| 18+ | Full athlete control |

- The **limits of confidentiality** are explained in plain language to the athlete and the guardian **before any service begins**.
- Who is notified, when and how, for a minor at risk, is a safeguarding and legal decision. It must be set by a clinical advisor and counsel before tier 2 holds real data.
- Abuse and misconduct reporting, moderation and secure messaging follow the same safeguarding policy.

## 12. Release gates

| Step | Contents | Gate | Status |
|---|---|---|---|
| **C1** Content | Mental-skills library, programmes (content), sport packs, match-day templates, parent and coach education | Qualified sports psychologist reviews the content. No personal data stored | Planned (days 31–60) |
| **C2** Private wellbeing space | Profile, check-ins, journal, programme progress, sharing with named people, safeguarding path | **Counsel and clinical advisor sign-off**; `care` schema; consent ledger in production; safeguarding protocol; escalation contacts | Planned (days 61–90 at the earliest) |
| **C3** Professional services | Directory, booking, consent, sessions, encrypted clinical records, follow-up, payment | C2 gates plus credential verification process and confirmed registration rules | Planned (days 61–90 at the earliest) |

Open decision (`TRIQ_AUDIT.md`, decision 5): name the advisors for sports psychology, safeguarding and counsel. Until then, Mind & Performance cannot go past content.

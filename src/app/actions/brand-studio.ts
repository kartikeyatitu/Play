"use server";
// TRIQ Brand Studio (V9): sponsors, campaigns, proposals, deliverables. Gated by FEATURES.sponsorship.
// Pure rules: src/lib/brand-studio.ts. Money commitments need funding.approve + typed confirmation.
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { checkPermission, requireMember, hasPermission } from "@/lib/membership";
import { FEATURES } from "@/lib/features";
import {
  canAcceptIn,
  canMoveCampaign,
  canMoveDeliverable,
  canMoveProposal,
  canSubmitTo,
  checkCommitment,
  rupeesToPaise,
  safeHttpUrlOrNull,
  validateCampaignInput,
  validateDeliverableInput,
  validateProposalInput,
  validateSponsorInput,
  type StatusEntity,
} from "@/lib/brand-studio";

const DISABLED = { success: false as const, error: "Brand Studio is not enabled" };

class BrandError extends Error {}

async function audit(userId: string, orgId: string, action: string, details: Record<string, unknown>) {
  await db.auditLog.create({ data: { userId, orgId, action, details: JSON.stringify(details) } }).catch(() => {});
}

function note(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : null;
}

function done() {
  revalidatePath("/org");
}

// ── Reads ──────────────────────────────────────────────────────────────────────

/** Everything the Brand Studio admin screen needs (sponsorship.manage). */
export async function listBrandStudio() {
  if (!FEATURES.sponsorship) return { ...DISABLED, data: null };
  const auth = await checkPermission("sponsorship.manage");
  if (!auth.ok) return { success: false, error: auth.error, data: null };
  const orgId = auth.session.orgId;
  const [sponsors, campaigns, students] = await Promise.all([
    db.sponsorProfile.findMany({ where: { orgId }, orderBy: [{ archivedAt: "asc" }, { name: "asc" }] }),
    db.sponsorshipCampaign.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: {
        sponsor: { select: { id: true, name: true } },
        proposals: { orderBy: { createdAt: "desc" }, include: { deliverables: { orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] } } },
      },
      take: 100,
    }),
    db.student.findMany({ where: { orgId }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 1000 }),
  ]);
  return {
    success: true,
    data: {
      canApprove: hasPermission(auth.membership, "funding.approve"),
      sponsors,
      campaigns,
      students,
    },
  };
}

/** OPEN campaigns any academy member can propose to (coaches, staff). */
export async function listOpenCampaigns() {
  if (!FEATURES.sponsorship) return { ...DISABLED, campaigns: [] };
  const { session } = await requireMember();
  const campaigns = await db.sponsorshipCampaign.findMany({
    where: { orgId: session.orgId, status: "OPEN" },
    select: { id: true, title: true, scope: true, objective: true, targetAudience: true, budgetPaise: true, endDate: true, sponsor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return { success: true, campaigns };
}

export async function getStatusHistory(entityType: StatusEntity, entityId: string) {
  if (!FEATURES.sponsorship && !FEATURES.inclusive) return { ...DISABLED, events: [] };
  const auth = await checkPermission(entityType === "PROGRAM" ? "fees.manage" : "sponsorship.manage");
  if (!auth.ok) return { success: false, error: auth.error, events: [] };
  const events = await db.sponsorshipStatusEvent.findMany({
    where: { orgId: auth.session.orgId, entityType, entityId: String(entityId) },
    orderBy: { createdAt: "asc" },
  });
  return { success: true, events };
}

// ── Sponsor profiles ───────────────────────────────────────────────────────────

export async function saveSponsorProfile(input: Record<string, unknown> & { id?: string }) {
  if (!FEATURES.sponsorship) return DISABLED;
  const auth = await checkPermission("sponsorship.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const v = validateSponsorInput(input);
  if (!v.ok) return { success: false, error: v.error };
  if (input.id) {
    const existing = await db.sponsorProfile.findFirst({ where: { id: String(input.id), orgId: session.orgId }, select: { id: true } });
    if (!existing) return { success: false, error: "Sponsor not found" };
    await db.sponsorProfile.update({ where: { id: existing.id }, data: v.value });
    await audit(session.id, session.orgId, "SPONSOR_PROFILE_UPDATED", { sponsorId: existing.id });
  } else {
    const s = await db.sponsorProfile.create({ data: { ...v.value, orgId: session.orgId, createdById: session.id } });
    await audit(session.id, session.orgId, "SPONSOR_PROFILE_CREATED", { sponsorId: s.id, kind: v.value.kind });
  }
  done();
  return { success: true };
}

export async function setSponsorArchived(id: string, archived: boolean) {
  if (!FEATURES.sponsorship) return DISABLED;
  const auth = await checkPermission("sponsorship.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const r = await db.sponsorProfile.updateMany({ where: { id: String(id), orgId: auth.session.orgId }, data: { archivedAt: archived ? new Date() : null } });
  if (r.count === 0) return { success: false, error: "Sponsor not found" };
  await audit(auth.session.id, auth.session.orgId, archived ? "SPONSOR_PROFILE_ARCHIVED" : "SPONSOR_PROFILE_RESTORED", { sponsorId: id });
  done();
  return { success: true };
}

// ── Campaigns ──────────────────────────────────────────────────────────────────

/** Create, or edit a campaign. Budget can only change while the campaign is a DRAFT. */
export async function saveCampaign(input: Record<string, unknown> & { id?: string }) {
  if (!FEATURES.sponsorship) return DISABLED;
  const auth = await checkPermission("sponsorship.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const v = validateCampaignInput(input);
  if (!v.ok) return { success: false, error: v.error };
  if (v.value.sponsorId) {
    const sp = await db.sponsorProfile.findFirst({ where: { id: v.value.sponsorId, orgId: session.orgId }, select: { id: true } });
    if (!sp) return { success: false, error: "Sponsor not found" };
  }
  if (input.id) {
    const existing = await db.sponsorshipCampaign.findFirst({ where: { id: String(input.id), orgId: session.orgId } });
    if (!existing) return { success: false, error: "Campaign not found" };
    if (existing.status === "COMPLETED" || existing.status === "CANCELLED") return { success: false, error: "This campaign is closed for edits" };
    if (existing.status !== "DRAFT" && v.value.budgetPaise !== existing.budgetPaise)
      return { success: false, error: "The budget is locked once a campaign is opened" };
    await db.sponsorshipCampaign.update({ where: { id: existing.id }, data: v.value });
    await audit(session.id, session.orgId, "SPONSORSHIP_CAMPAIGN_UPDATED", { campaignId: existing.id, budgetPaise: v.value.budgetPaise });
  } else {
    const c = await db.sponsorshipCampaign.create({ data: { ...v.value, orgId: session.orgId, createdById: session.id } });
    await db.sponsorshipStatusEvent.create({ data: { orgId: session.orgId, entityType: "CAMPAIGN", entityId: c.id, toStatus: "DRAFT", actorId: session.id } });
    await audit(session.id, session.orgId, "SPONSORSHIP_CAMPAIGN_CREATED", { campaignId: c.id, budgetPaise: v.value.budgetPaise, scope: v.value.scope });
  }
  done();
  return { success: true };
}

export async function setCampaignStatus(id: string, to: string, statusNote?: string) {
  if (!FEATURES.sponsorship) return DISABLED;
  const auth = await checkPermission("sponsorship.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const c = await db.sponsorshipCampaign.findFirst({ where: { id: String(id), orgId: session.orgId }, select: { id: true, status: true } });
  if (!c) return { success: false, error: "Campaign not found" };
  if (!canMoveCampaign(c.status, to)) return { success: false, error: `Can't move a campaign from ${c.status} to ${to}` };
  const moved = await db.sponsorshipCampaign.updateMany({ where: { id: c.id, orgId: session.orgId, status: c.status }, data: { status: to } });
  if (moved.count === 0) return { success: false, error: "Status changed; refresh and try again" };
  await db.sponsorshipStatusEvent.create({
    data: { orgId: session.orgId, entityType: "CAMPAIGN", entityId: c.id, fromStatus: c.status, toStatus: to, actorId: session.id, note: note(statusNote) },
  });
  await audit(session.id, session.orgId, "SPONSORSHIP_CAMPAIGN_STATUS", { campaignId: c.id, from: c.status, to });
  done();
  return { success: true };
}

// ── Proposals ──────────────────────────────────────────────────────────────────

/** Any active academy member can submit a proposal to an OPEN campaign. */
export async function submitProposal(input: Record<string, unknown>) {
  if (!FEATURES.sponsorship) return DISABLED;
  const { session } = await requireMember();
  const v = validateProposalInput(input);
  if (!v.ok) return { success: false, error: v.error };
  const campaign = await db.sponsorshipCampaign.findFirst({ where: { id: v.value.campaignId, orgId: session.orgId }, select: { id: true, status: true, budgetPaise: true } });
  if (!campaign) return { success: false, error: "Campaign not found" };
  if (!canSubmitTo(campaign.status)) return { success: false, error: "This campaign is not accepting proposals" };
  if (v.value.askPaise > campaign.budgetPaise) return { success: false, error: "The ask is larger than the campaign budget" };
  if (v.value.studentId) {
    const st = await db.student.findFirst({ where: { id: v.value.studentId, orgId: session.orgId }, select: { id: true } });
    if (!st) return { success: false, error: "Student not found" };
  }
  const p = await db.sponsorshipProposal.create({ data: { ...v.value, orgId: session.orgId, submittedById: session.id } });
  await db.sponsorshipStatusEvent.create({ data: { orgId: session.orgId, entityType: "PROPOSAL", entityId: p.id, toStatus: "SUBMITTED", actorId: session.id } });
  await audit(session.id, session.orgId, "SPONSORSHIP_PROPOSAL_SUBMITTED", { proposalId: p.id, campaignId: campaign.id, askPaise: v.value.askPaise });
  done();
  return { success: true };
}

/** Review moves: UNDER_REVIEW / REJECTED (sponsorship.manage); WITHDRAWN (submitter or manager). Never ACCEPTED. */
export async function setProposalStatus(id: string, to: string, statusNote?: string) {
  if (!FEATURES.sponsorship) return DISABLED;
  if (to === "ACCEPTED") return { success: false, error: "Use Accept, which needs funding approval" };
  const { session, membership } = await requireMember();
  const p = await db.sponsorshipProposal.findFirst({ where: { id: String(id), orgId: session.orgId }, select: { id: true, status: true, submittedById: true } });
  if (!p) return { success: false, error: "Proposal not found" };
  const isManager = hasPermission(membership, "sponsorship.manage");
  const allowed = isManager || (to === "WITHDRAWN" && p.submittedById === session.id);
  if (!allowed) return { success: false, error: "You don't have permission to do this" };
  if (!canMoveProposal(p.status, to)) return { success: false, error: `Can't move a proposal from ${p.status} to ${to}` };
  const decided = to === "REJECTED";
  const moved = await db.sponsorshipProposal.updateMany({
    where: { id: p.id, orgId: session.orgId, status: p.status },
    data: { status: to, ...(decided ? { decidedById: session.id, decidedAt: new Date(), decisionNote: note(statusNote) } : {}) },
  });
  if (moved.count === 0) return { success: false, error: "Status changed; refresh and try again" };
  await db.sponsorshipStatusEvent.create({
    data: { orgId: session.orgId, entityType: "PROPOSAL", entityId: p.id, fromStatus: p.status, toStatus: to, actorId: session.id, note: note(statusNote) },
  });
  await audit(session.id, session.orgId, "SPONSORSHIP_PROPOSAL_STATUS", { proposalId: p.id, from: p.status, to });
  done();
  return { success: true };
}

/**
 * Accept a reviewed proposal and commit money from the campaign budget.
 * Requires funding.approve AND the approver re-typing the amount. The budget check runs inside one
 * conditional UPDATE so two concurrent accepts can never commit more than the budget.
 */
export async function acceptProposal(id: string, approvedAmount: number | string, confirmAmount: number | string, decisionNote?: string) {
  if (!FEATURES.sponsorship) return DISABLED;
  const auth = await checkPermission("funding.approve");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const approved = rupeesToPaise(approvedAmount);
  if (!approved.ok) return { success: false, error: approved.error };
  const confirm = rupeesToPaise(confirmAmount);
  if (!confirm.ok) return { success: false, error: "Re-type the approved amount to confirm" };

  const p = await db.sponsorshipProposal.findFirst({
    where: { id: String(id), orgId: session.orgId },
    include: { campaign: { select: { id: true, status: true, budgetPaise: true, committedPaise: true } } },
  });
  if (!p) return { success: false, error: "Proposal not found" };
  if (!canMoveProposal(p.status, "ACCEPTED")) return { success: false, error: "Only proposals under review can be accepted" };
  if (!canAcceptIn(p.campaign.status)) return { success: false, error: "This campaign can no longer accept proposals" };
  const check = checkCommitment({
    approvedPaise: approved.value,
    confirmPaise: confirm.value,
    budgetPaise: p.campaign.budgetPaise,
    committedPaise: p.campaign.committedPaise,
  });
  if (!check.ok) return { success: false, error: check.error };

  try {
    await db.$transaction(async (tx) => {
      const amt = approved.value;
      const committed = await tx.$executeRaw`
        UPDATE "SponsorshipCampaign"
           SET "committedPaise" = "committedPaise" + ${amt}, "updatedAt" = NOW()
         WHERE "id" = ${p.campaign.id} AND "orgId" = ${session.orgId}
           AND "status" IN ('OPEN', 'CLOSED')
           AND "committedPaise" + ${amt} <= "budgetPaise"`;
      if (committed === 0) throw new BrandError("Budget exceeded or campaign changed; refresh and try again");
      const moved = await tx.sponsorshipProposal.updateMany({
        where: { id: p.id, orgId: session.orgId, status: "UNDER_REVIEW" },
        data: { status: "ACCEPTED", approvedPaise: amt, decidedById: session.id, decidedAt: new Date(), decisionNote: note(decisionNote) },
      });
      if (moved.count === 0) throw new BrandError("Status changed; refresh and try again");
      await tx.sponsorshipStatusEvent.create({
        data: { orgId: session.orgId, entityType: "PROPOSAL", entityId: p.id, fromStatus: "UNDER_REVIEW", toStatus: "ACCEPTED", actorId: session.id, note: note(decisionNote) },
      });
    });
  } catch (e) {
    if (e instanceof BrandError) return { success: false, error: e.message };
    throw e;
  }
  await audit(session.id, session.orgId, "SPONSORSHIP_PROPOSAL_ACCEPTED", { proposalId: p.id, campaignId: p.campaign.id, approvedPaise: approved.value });
  done();
  return { success: true };
}

// ── Deliverables & milestones ──────────────────────────────────────────────────

export async function addDeliverable(input: Record<string, unknown>) {
  if (!FEATURES.sponsorship) return DISABLED;
  const auth = await checkPermission("sponsorship.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const v = validateDeliverableInput(input);
  if (!v.ok) return { success: false, error: v.error };
  const p = await db.sponsorshipProposal.findFirst({ where: { id: v.value.proposalId, orgId: session.orgId }, select: { id: true, status: true } });
  if (!p) return { success: false, error: "Proposal not found" };
  if (p.status !== "ACCEPTED") return { success: false, error: "Deliverables are agreed after a proposal is accepted" };
  const d = await db.sponsorshipDeliverable.create({ data: { ...v.value, orgId: session.orgId, createdById: session.id } });
  await db.sponsorshipStatusEvent.create({ data: { orgId: session.orgId, entityType: "DELIVERABLE", entityId: d.id, toStatus: "PENDING", actorId: session.id } });
  await audit(session.id, session.orgId, "SPONSORSHIP_DELIVERABLE_ADDED", { deliverableId: d.id, proposalId: p.id, kind: v.value.kind });
  done();
  return { success: true };
}

export async function setDeliverableStatus(id: string, to: string, opts: { evidenceUrl?: string; note?: string } = {}) {
  if (!FEATURES.sponsorship) return DISABLED;
  const auth = await checkPermission("sponsorship.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const d = await db.sponsorshipDeliverable.findFirst({ where: { id: String(id), orgId: session.orgId }, select: { id: true, status: true, evidenceUrl: true } });
  if (!d) return { success: false, error: "Deliverable not found" };
  if (!canMoveDeliverable(d.status, to)) return { success: false, error: `Can't move from ${d.status} to ${to}` };
  const evidence = safeHttpUrlOrNull(opts.evidenceUrl);
  if (evidence === false) return { success: false, error: "Evidence link must start with http:// or https://" };
  const data: Record<string, unknown> = { status: to, note: note(opts.note) };
  if (evidence) data.evidenceUrl = evidence;
  if (to === "DELIVERED") data.completedAt = new Date();
  if (to === "IN_PROGRESS") data.completedAt = null;
  if (to === "VERIFIED") data.verifiedById = session.id;
  const moved = await db.sponsorshipDeliverable.updateMany({ where: { id: d.id, orgId: session.orgId, status: d.status }, data });
  if (moved.count === 0) return { success: false, error: "Status changed; refresh and try again" };
  await db.sponsorshipStatusEvent.create({
    data: { orgId: session.orgId, entityType: "DELIVERABLE", entityId: d.id, fromStatus: d.status, toStatus: to, actorId: session.id, note: note(opts.note) },
  });
  await audit(session.id, session.orgId, "SPONSORSHIP_DELIVERABLE_STATUS", { deliverableId: d.id, from: d.status, to, hasEvidence: !!(evidence || d.evidenceUrl) });
  done();
  return { success: true };
}

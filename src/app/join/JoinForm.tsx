"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerParent, type RegisterParentState } from "./actions";

type JoinBatch = { id: string; name: string; sport: string };

const initialState: RegisterParentState = {};

export default function JoinForm({ slug, batches }: { orgName?: string; slug: string; batches: JoinBatch[] }) {
  const [state, formAction, pending] = useActionState(registerParent, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="academy" value={slug} />
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-cyan-400">Parent Details</h3>
        <Input name="parentName" placeholder="Parent Name" required minLength={2} maxLength={80} className="bg-zinc-950 border-zinc-800" />
        <Input name="parentPhone" type="tel" placeholder="Parent Phone Number" required className="bg-zinc-950 border-zinc-800" />
      </div>
      <div className="space-y-2 pt-2">
        <h3 className="text-sm font-bold text-cyan-400">Player Details</h3>
        <Input name="childName" placeholder="Child's Full Name" required minLength={2} maxLength={80} className="bg-zinc-950 border-zinc-800" />
        <label className="block text-xs text-zinc-500">Date of birth (optional)</label>
        <Input name="dob" type="date" className="bg-zinc-950 border-zinc-800 text-zinc-400" />
      </div>
      <div className="space-y-2 pt-2">
        <h3 className="text-sm font-bold text-cyan-400">Select Batch</h3>
        <select name="batchId" required className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-sm">
          <option value="">Select a batch...</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.sport})
            </option>
          ))}
        </select>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
          {state.error}
        </p>
      )}
      <div className="pt-4">
        <Button type="submit" disabled={pending} className="w-full bg-cyan-500 text-zinc-950 hover:bg-cyan-600 font-bold">
          {pending ? "Submitting..." : "Submit Registration"}
        </Button>
        <p className="text-xs text-zinc-500 text-center mt-3">
          By registering, you agree to the academy&apos;s digital waiver and terms of service.
        </p>
      </div>
    </form>
  );
}

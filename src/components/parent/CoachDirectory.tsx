"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle, Clock } from "lucide-react";

export function CoachDirectory({ coaches }: { coaches: any[] }) {
  const [search, setSearch] = useState("");

  const filteredCoaches = coaches.filter(coach => {
    const term = search.toLowerCase();
    const matchName = coach.name?.toLowerCase().includes(term);
    const sports = coach.batches?.map((b: any) => b.sport?.toLowerCase()) || [];
    const matchSport = sports.some((s: string) => s.includes(term));
    return matchName || matchSport;
  });

  return (
    <div className="space-y-6 text-zinc-100 p-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">Coach Directory</h2>
        <p className="text-zinc-400">Meet our trusted academy coaches</p>
      </div>

      <Input
        placeholder="Search by name or sport..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md bg-zinc-950 border-zinc-800 text-zinc-100"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCoaches.map((coach, idx) => {
          const sports = Array.from(new Set(coach.batches?.map((b: any) => b.sport) || [])) as string[];
          const batchesCount = coach.batches?.length || 0;
          
          let verifiedSteps = 0;
          let totalSteps = 5;
          let isFullyVerified = coach.verified;
          
          if (coach.verificationData) {
            try {
              const parsed = JSON.parse(coach.verificationData);
              if (parsed.steps) {
                totalSteps = parsed.steps.length;
                verifiedSteps = parsed.steps.filter((s: any) => s.status === 'VERIFIED').length;
              }
            } catch (e) {}
          }
          
          return (
            <Card key={idx} className="bg-zinc-950 border-zinc-800">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl">{coach.name}</CardTitle>
                  {isFullyVerified ? (
                    <Badge variant="emerald" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                      <CheckCircle className="h-3 w-3 mr-1" /> Fully Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-500 border-amber-500/20 bg-amber-500/10">
                      <Clock className="h-3 w-3 mr-1" /> {verifiedSteps}/{totalSteps} Verified
                    </Badge>
                  )}
                </div>
                {coach.experience > 0 && (
                  <div className="text-sm text-zinc-400 mt-1">
                    {coach.experience} years experience
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-zinc-500 mb-2">Sports</div>
                  <div className="flex flex-wrap gap-2">
                    {sports.length > 0 ? (
                      sports.map(s => <Badge key={s} variant="sky">{s}</Badge>)
                    ) : (
                      <span className="text-sm text-zinc-600">None assigned</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-zinc-500 mb-1">Verification Details</div>
                  <div className="text-xs text-zinc-400 bg-zinc-900 p-2 rounded-md border border-zinc-800">
                    <span className="flex items-center gap-1">Verified: ID {verifiedSteps >= 1 ? '✅' : '⏳'} Certificate {verifiedSteps >= 2 ? '✅' : '⏳'} Background {verifiedSteps >= 3 ? '✅' : '⏳'} Experience {verifiedSteps >= 4 ? '✅' : '⏳'} First Aid {verifiedSteps >= 5 ? '✅' : '⏳'}</span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-zinc-500 mb-1">Batches</div>
                  <div className="text-sm">Handles {batchesCount} active batch{batchesCount !== 1 ? 'es' : ''}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        
        {filteredCoaches.length === 0 && (
          <div className="col-span-full text-center py-8 text-zinc-500">
            No coaches found matching your search.
          </div>
        )}
      </div>
    </div>
  );
}

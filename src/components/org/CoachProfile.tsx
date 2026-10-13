"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toggleCoachVerification } from "@/app/actions/verification";

export function CoachProfile({ coach }: { coach: any }) {
  const initials = coach.name ? coach.name.substring(0, 2).toUpperCase() : "??";
  
  const sports = Array.from(new Set(coach.batches?.map((b: any) => b.sport) || [])) as string[];
  const totalStudents = coach.batches?.reduce((acc: number, b: any) => acc + (b.students || 0), 0) || 0;
  
  const [experience, setExperience] = useState(coach.experience || 0);
  const [backgroundChecked, setBackgroundChecked] = useState(false);
  const [firstAid, setFirstAid] = useState(false);
  const [idProof, setIdProof] = useState<File | null>(null);
  const [certificate, setCertificate] = useState<File | null>(null);
  const [specializations, setSpecializations] = useState<string[]>(sports);
  const [newSport, setNewSport] = useState("");

  const verifiedItems = [
    idProof !== null,
    certificate !== null,
    backgroundChecked,
    experience > 0,
    firstAid
  ];
  const verifiedCount = verifiedItems.filter(Boolean).length;
  const progressPercent = (verifiedCount / 5) * 100;

  return (
    <div className="space-y-6 text-zinc-100 p-4">
      <Card className="bg-zinc-950 border-zinc-800">
        <CardHeader className="flex flex-row items-center gap-6 pb-2">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-3xl font-bold">
            {initials}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <CardTitle className="text-2xl">{coach.name}</CardTitle>
              {coach.verified ? (
                <Badge variant="emerald">✅ Verified Coach</Badge>
              ) : (
                <Badge variant="amber">⚠️ Unverified</Badge>
              )}
            </div>
            <CardDescription className="text-zinc-400 mt-1">{coach.phone}</CardDescription>
            <div className="flex gap-2 mt-3">
              {sports.map(sport => (
                <Badge key={sport} variant="sky">{sport}</Badge>
              ))}
            </div>
          </div>
          <div>
            <Button
              variant={coach.verified ? "destructive" : "default"}
              className={!coach.verified ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              onClick={async () => {
                await toggleCoachVerification(coach.id, !coach.verified);
              }}
            >
              {coach.verified ? "Revoke Verification" : "Mark as Verified"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader>
            <CardTitle>Verification Checklist</CardTitle>
            <CardDescription>
              {verifiedCount}/5 verified ({progressPercent}%)
            </CardDescription>
            <div className="w-full bg-zinc-900 rounded-full h-2.5 mt-2">
              <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {idProof ? '✅' : '⏳'} ID Proof (Aadhaar / PAN)
              </span>
              <Input type="file" className="w-1/2 bg-zinc-900/40 border-zinc-800" onChange={(e) => setIdProof(e.target.files?.[0] || null)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {certificate ? '✅' : '⏳'} Coaching Certificate
              </span>
              <Input type="file" className="w-1/2 bg-zinc-900/40 border-zinc-800" onChange={(e) => setCertificate(e.target.files?.[0] || null)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {backgroundChecked ? '✅' : '⏳'} Background Check
              </span>
              <input type="checkbox" checked={backgroundChecked} onChange={(e) => setBackgroundChecked(e.target.checked)} className="w-5 h-5 accent-emerald-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {experience > 0 ? '✅' : '⏳'} Experience Verified (years)
              </span>
              <Input type="number" min="0" value={experience} onChange={(e) => setExperience(parseInt(e.target.value) || 0)} className="w-24 bg-zinc-900/40 border-zinc-800" />
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {firstAid ? '✅' : '⏳'} First Aid Certified
              </span>
              <input type="checkbox" checked={firstAid} onChange={(e) => setFirstAid(e.target.checked)} className="w-5 h-5 accent-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader>
            <CardTitle>Coach Stats</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900/40 p-4 rounded-lg border border-zinc-800 text-center">
              <div className="text-2xl font-bold text-sky-400">{totalStudents}</div>
              <div className="text-sm text-zinc-400">Total Students</div>
            </div>
            <div className="bg-zinc-900/40 p-4 rounded-lg border border-zinc-800 text-center">
              <div className="text-2xl font-bold text-purple-400">{coach.batches?.length || 0}</div>
              <div className="text-sm text-zinc-400">Batches</div>
            </div>
            <div className="bg-zinc-900/40 p-4 rounded-lg border border-zinc-800 text-center col-span-2 flex flex-col items-center">
              <div className="text-sm text-zinc-400 mb-1">Sports Coached</div>
              <div className="flex gap-2 flex-wrap justify-center">
                {sports.length > 0 ? sports.map(s => <Badge key={s} variant="outline">{s}</Badge>) : <span className="text-zinc-500">None</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader>
            <CardTitle>Specializations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {specializations.map(sport => (
                <Badge key={sport} variant="purple" className="px-3 py-1 cursor-pointer" onClick={() => setSpecializations(specializations.filter(s => s !== sport))}>
                  {sport} &times;
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input 
                value={newSport} 
                onChange={(e) => setNewSport(e.target.value)} 
                placeholder="e.g. Swimming" 
                className="bg-zinc-900/40 border-zinc-800 text-zinc-100"
              />
              <Button 
                onClick={() => {
                  if (newSport && !specializations.includes(newSport)) {
                    setSpecializations([...specializations, newSport]);
                    setNewSport("");
                  }
                }}
              >
                Add Sport
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            {coach.batches?.length ? (
              <div className="space-y-3">
                {coach.batches.map((batch: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-md bg-zinc-900/40 border border-zinc-800">
                    <div>
                      <div className="font-medium">{batch.name}</div>
                      <div className="text-sm text-zinc-400">{batch.sport}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">{batch.day}</div>
                      <div className="text-xs text-zinc-400">{batch.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-zinc-500 text-center py-4">No scheduled batches</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

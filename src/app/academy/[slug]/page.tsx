import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MapPin, Users, Trophy, Calendar } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default async function AcademyProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await db.organization.findUnique({
    where: { slug },
    include: {
      batches: true,
      // Public page: only counts — never load student rows or coach user rows (phone, password hash)
      _count: {
        select: {
          students: true,
          users: { where: { role: "COACH" } },
        },
      },
    },
  });

  if (!org) {
    notFound();
  }

  const sports = Array.from(new Set(org.batches.map(b => b.sport).filter(Boolean)));
  const coachCount = org._count.users;
  const studentCount = org._count.students;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header Banner */}
      <div className="bg-zinc-900 border-b border-zinc-800 pt-16 pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4">
              {org.logo ? (
                <img src={org.logo} alt={org.name} className="w-16 h-16 rounded-xl object-cover border border-zinc-700 shadow-md" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-zinc-950 font-black text-2xl shadow-md">
                  {org.name.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-white">{org.name}</h1>
                <div className="flex flex-wrap gap-4 text-zinc-400 text-sm">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span>{org.city}, {org.state}{org.pincode ? ` - ${org.pincode}` : ""}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <span>{studentCount} Students</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>{coachCount} Coaches</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Link href={`/trial?academy=${org.slug}`} className={cn(buttonVariants({ variant: "outline" }), "bg-transparent border-zinc-700 hover:bg-zinc-800")}>
                Book Free Trial
              </Link>
              <Link href={`/join?academy=${org.slug}`} className={cn(buttonVariants({ variant: "default" }), "bg-emerald-500 text-emerald-950 hover:bg-emerald-400 font-semibold")}>
                Enroll Now
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid md:grid-cols-3 gap-12">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-12">
          {/* About Section (Mock description) */}
          <section>
            <h2 className="text-2xl font-bold mb-6">About the Academy</h2>
            <p className="text-zinc-400 leading-relaxed">
              Welcome to {org.name}. We are dedicated to providing top-tier sports training 
              and development in {org.city}. Our professional coaches focus on holistic 
              athlete development, combining technical skills with physical conditioning 
              and mental toughness.
            </p>
            {sports.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {sports.map(sport => (
                  <Badge key={sport} variant="outline" className="bg-zinc-800 text-emerald-400">
                    {sport}
                  </Badge>
                ))}
              </div>
            )}
          </section>

          {/* Batches / Schedules */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Available Programs</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {org.batches.length > 0 ? (
                org.batches.map(batch => (
                  <div key={batch.id} className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-semibold text-lg">{batch.name}</h3>
                      {batch.sport && (
                        <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">
                          {batch.sport}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2 text-sm text-zinc-400">
                      {batch.schedule && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{batch.schedule}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>Capacity: Open</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-zinc-500 italic">No programs currently listed.</p>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8">
          <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900">
            <h3 className="font-semibold mb-4 text-lg">Contact Info</h3>
            <div className="space-y-4 text-zinc-400 text-sm">
              {org.phone && (
                <div>
                  <strong className="block text-zinc-300 mb-1">Phone</strong>
                  {org.phone}
                </div>
              )}
              {org.email && (
                <div>
                  <strong className="block text-zinc-300 mb-1">Email</strong>
                  {org.email}
                </div>
              )}
              {org.address && (
                <div>
                  <strong className="block text-zinc-300 mb-1">Address</strong>
                  {org.address}
                </div>
              )}
              {!org.phone && !org.email && !org.address && (
                <p>Contact details not provided.</p>
              )}
            </div>
          </div>
          
          <div className="p-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
            <h3 className="font-semibold text-emerald-400 mb-2">Ready to join?</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Start your journey with us today. Book a free trial session or enroll directly.
            </p>
            <Link href={`/join?academy=${org.slug}`} className={cn(buttonVariants({ variant: "default" }), "w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400")}>
              Enroll Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

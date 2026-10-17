"use client";

import React, { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Share2, Star, MessageSquareQuote } from "lucide-react";
import { addTestimonial } from "@/app/actions/testimonials";
import { getAppUrl } from "@/lib/app-url";

interface TestimonialCollectorProps {
  academyName: string;
  testimonials: any[];
  parents: any[];
}

export function TestimonialCollector({ academyName, testimonials, parents }: TestimonialCollectorProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({ parentId: '', rating: 5, comment: '' });

  const shareLink = `${getAppUrl()}/${academyName.toLowerCase().replace(/\s+/g, '')}/review`;
  const whatsappMsg = `Hi! We'd love your feedback on ${academyName}. Please share a quick testimonial: ${shareLink}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(whatsappMsg)}`, "_blank");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.parentId) return alert("Please select a parent");
    startTransition(async () => {
      await addTestimonial(form);
      setForm({ parentId: '', rating: 5, comment: '' });
    });
  };

  const copyForInstagram = (t: any) => {
    const text = `⭐⭐⭐⭐⭐\n\n"${t.comment}"\n\n- ${t.parent?.name || "Parent"}\n\n${academyName} | Where Champions Train\n\n#Testimonial #HappyParents #TrustedAcademy`;
    navigator.clipboard.writeText(text);
  };

  return (
    <Card className="bg-zinc-950 border-zinc-800 text-zinc-100">
      <CardHeader>
        <CardTitle>Testimonial Collector</CardTitle>
        <CardDescription className="text-zinc-400">Collect and display reviews from parents</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="collect">
          <TabsList className="grid w-full grid-cols-2 bg-zinc-900">
            <TabsTrigger value="collect">Collect Testimonials</TabsTrigger>
            <TabsTrigger value="display">Display Wall</TabsTrigger>
          </TabsList>

          <TabsContent value="collect" className="space-y-6 mt-6">
            <div className="p-4 bg-zinc-900/40 rounded-lg border border-zinc-800">
              <h4 className="font-semibold mb-2">Ask parents for reviews</h4>
              <p className="text-sm text-zinc-400 mb-4">Share this link with parents to collect their feedback.</p>
              <div className="flex gap-2 mb-4">
                <Input value={shareLink} readOnly className="bg-zinc-900 border-zinc-700 text-zinc-300" />
                <Button variant="outline" onClick={copyLink} className="border-zinc-700 text-zinc-300">
                  {copiedLink ? "Copied!" : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <Button onClick={shareWhatsApp} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                <Share2 className="w-4 h-4 mr-2" /> Share on WhatsApp
              </Button>
            </div>

            <div className="p-4 bg-zinc-900/40 rounded-lg border border-zinc-800">
              <h4 className="font-semibold mb-4">Manual Entry Form</h4>
              <form onSubmit={handleSubmit} className="space-y-4">
                <select 
                  value={form.parentId} 
                  onChange={e => setForm({...form, parentId: e.target.value})} 
                  className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                >
                  <option value="">Select Parent</option>
                  {parents.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <Input type="number" min="1" max="5" placeholder="Rating (1-5)" value={form.rating} onChange={e => setForm({...form, rating: parseInt(e.target.value)})} className="bg-zinc-900 border-zinc-700" required />
                <Input placeholder="Review Text" value={form.comment} onChange={e => setForm({...form, comment: e.target.value})} className="bg-zinc-900 border-zinc-700" required />
                <Button disabled={isPending} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                  {isPending ? "Saving..." : "Save Testimonial"}
                </Button>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="display" className="space-y-4 mt-6">
            {testimonials.map((t) => (
              <Card key={t.id} className="bg-zinc-900/40 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-zinc-100">{t.parent?.name || "Parent"}</h4>
                      <p className="text-xs text-zinc-400">{new Date(t.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex text-amber-400">
                      {[...Array(t.rating)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
                    </div>
                  </div>
                  <p className="text-zinc-300 text-sm mb-4 line-clamp-3">{t.comment}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyForInstagram(t)} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs">
                      <Copy className="w-3 h-3 mr-1" /> Share on Instagram
                    </Button>
                    <Button variant="outline" size="sm" className="border-emerald-700 text-emerald-400 hover:bg-emerald-950 text-xs">
                      <Share2 className="w-3 h-3 mr-1" /> WhatsApp
                    </Button>
                    <Button variant="outline" size="sm" className="border-sky-700 text-sky-400 hover:bg-sky-950 text-xs">
                      <MessageSquareQuote className="w-3 h-3 mr-1" /> Google Review
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {testimonials.length === 0 && (
              <div className="text-center p-4 text-zinc-400">No testimonials found.</div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Share2, Instagram } from "lucide-react";

interface InstagramGeneratorProps {
  academyName: string;
  stats: {
    students: number;
    batches: number;
    sports: number;
  };
  sportNames?: string[];
}

export function InstagramGenerator({ academyName, stats, sportNames = ["Sports"] }: InstagramGeneratorProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  const [inputs, setInputs] = useState({
    studentName: 'Rahul Kumar',
    achievement: 'Man of the Match',
    sport: sportNames.length > 0 ? sportNames[0] : 'Cricket',
    phone: '+91 9876543210',
    location: 'Main Sports Complex',
    testimonial: 'Best coaching academy ever!',
    parentName: 'Amit Sharma',
    childName: 'Aryan'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
  };

  const formattedSportsList = sportNames.length > 0 ? sportNames.map(s => `🏅 ${s}`).join(" | ") : "⚽ Football | 🏏 Cricket";

  const templates = [
    {
      id: "achievement",
      title: "Achievement Post",
      content: `🏆 PROUD MOMENT!\n\nCongratulations to ${inputs.studentName} for ${inputs.achievement}!\n\n🏋️ Trained at ${academyName}\n🏅 Sport: ${inputs.sport}\n⭐ Keep shining!\n\n#ProudCoach #SportsAcademy #YouthSports #${inputs.sport.replace(/\s+/g, '')}`,
      inputs: ['studentName', 'achievement', 'sport']
    },
    {
      id: "enrollment",
      title: "Enrollment Post",
      content: `📢 ADMISSIONS OPEN!\n\n${academyName} is enrolling for:\n${formattedSportsList}\n\n✅ Professional coaching\n✅ Age-appropriate batches\n✅ Affordable fees from ₹2,500/mo\n\n📞 Contact: ${inputs.phone}\n📍 ${inputs.location}\n\n#JoinNow #SportsAcademy #Admissions`,
      inputs: ['phone', 'location']
    },
    {
      id: "stats",
      title: "Results/Stats Post",
      content: `📊 THIS MONTH AT ${academyName.toUpperCase()}\n\n👥 ${stats.students}+ students trained\n🏅 ${stats.batches} active batches\n🎯 ${stats.sports} sports offered (${sportNames.join(", ")})\n💪 90% attendance rate\n\n#Results #SportsTraining #Excellence`,
      inputs: []
    },
    {
      id: "testimonial",
      title: "Testimonial Post",
      content: `⭐⭐⭐⭐⭐\n\n"${inputs.testimonial}"\n\n- ${inputs.parentName}, Parent of ${inputs.childName}\n\n${academyName} | Where Champions Train\n\n#Testimonial #HappyParents #TrustedAcademy`,
      inputs: ['testimonial', 'parentName', 'childName']
    }
  ];

  const copyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const shareWhatsApp = (text: string) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <Card className="bg-zinc-950 border-zinc-800 text-zinc-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Instagram className="w-5 h-5 text-rose-500" /> Instagram Post Generator
        </CardTitle>
        <CardDescription className="text-zinc-400">Create high-converting social media posts</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="achievement" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 bg-zinc-900 mb-6 h-auto p-1">
            {templates.map(t => (
              <TabsTrigger key={t.id} value={t.id} className="text-xs py-2 data-[state=active]:bg-zinc-800">
                {t.title}
              </TabsTrigger>
            ))}
          </TabsList>

          {templates.map((template, index) => (
            <TabsContent key={template.id} value={template.id} className="space-y-6">
              
              {template.inputs.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-zinc-900/40 rounded-lg border border-zinc-800">
                  {template.inputs.map(inputKey => (
                    <div key={inputKey}>
                      <label className="text-xs text-zinc-400 mb-1 block capitalize">{inputKey.replace(/([A-Z])/g, ' $1').trim()}</label>
                      <Input 
                        name={inputKey} 
                        value={inputs[inputKey as keyof typeof inputs]} 
                        onChange={handleChange}
                        className="bg-zinc-900 border-zinc-700 h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 font-mono text-sm whitespace-pre-wrap text-zinc-300">
                {template.content}
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={() => copyText(template.content, index)} 
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Copy className="w-4 h-4 mr-2" /> 
                  {copiedIndex === index ? "Copied!" : "Copy to Clipboard"}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => shareWhatsApp(template.content)} 
                  className="flex-1 border-emerald-700 text-emerald-400 hover:bg-emerald-950"
                >
                  <Share2 className="w-4 h-4 mr-2" /> Share on WhatsApp
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

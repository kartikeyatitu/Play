"use client"
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export interface SocialStats {
  students: number;
  batches: number;
  sports: number;
}

export interface SocialPostGeneratorProps {
  academyName?: string;
  stats: SocialStats;
}

export function SocialPostGenerator({ academyName = 'Triq Academy', stats }: SocialPostGeneratorProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [customPost, setCustomPost] = useState('');

  const templates = [
    `🏆 Proud of our ${stats.students} young athletes training across ${stats.batches} batches! Join us for Football, Cricket, Tennis & more. 📞 Book a trial: [link]`,
    `⚽ Training day highlights! Our U-10 Football Stars showed amazing teamwork today. 💪 #SportsAcademy #Football #Training`,
    `📢 New batch starting! Limited spots available for Badminton Beginners. Register now! 🏸`,
    `🎉 Congratulations to our ${stats.students} students for completing another great month of training! Keep pushing! 💪`
  ];

  const handleCopy = (text: string, index?: number) => {
    navigator.clipboard.writeText(text);
    if (index !== undefined) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  return (
    <Card className="bg-zinc-950 border-zinc-800 text-zinc-100">
      <CardHeader>
        <CardTitle>Social Media Post Generator</CardTitle>
        <CardDescription className="text-zinc-400">Create quick posts for {academyName}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-400">Templates</h3>
          {templates.map((template, idx) => (
            <div key={idx} className="p-4 bg-zinc-900/40 rounded-md border border-zinc-800 flex flex-col gap-3">
              <p className="text-sm whitespace-pre-wrap">{template}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="self-end bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-100"
                onClick={() => handleCopy(template, idx)}
              >
                {copiedIndex === idx ? 'Copied!' : 'Copy to Clipboard'}
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-400">Custom Post</h3>
          <textarea 
            className="w-full min-h-[100px] p-3 rounded-md bg-zinc-900/40 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-700"
            value={customPost}
            onChange={(e) => setCustomPost(e.target.value)}
            placeholder="Write your custom post here..."
          />
          <Button 
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
            onClick={() => handleCopy(customPost)}
            disabled={!customPost}
          >
            Copy Custom Post
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

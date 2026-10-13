"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Share2, CheckCircle2, Clock } from "lucide-react";

interface ContentItem {
  id: string;
  day: string;
  type: string;
  caption: string;
  hashtags: string;
  status: 'posted' | 'scheduled' | 'pending';
}

interface ContentCalendarProps {
  batches?: any[];
}

export function ContentCalendar({ batches = [] }: ContentCalendarProps) {
  const sports = [...new Set(batches.map(b => b.sport).filter(Boolean))];
  const mainSport = sports.length > 0 ? sports[0] : "Sports";
  const allSportsHashtags = sports.length > 0 ? sports.map(s => `#${s}`).join(" ") : "#SportsAcademy";

  const getInitialContent = (): Record<string, ContentItem[]> => ({
    "Week 1": [
      { id: "w1-1", day: "Mon", type: "🏋️ Training Day Photo", caption: `Behind the scenes of our intense ${mainSport} training session today! Consistency is the key to success.`, hashtags: `${allSportsHashtags} #YouthSports #TrainingDay`, status: "pending" },
      { id: "w1-2", day: "Wed", type: "⭐ Student Spotlight", caption: "So proud of our rising star! Keep pushing your limits.", hashtags: "#StudentSpotlight #FutureChampion", status: "pending" },
      { id: "w1-3", day: "Fri", type: "📊 Weekly Stats", caption: `What a week it has been for our ${sports.length > 1 ? 'academy' : mainSport + ' batches'}! Incredible attendance and amazing progress.`, hashtags: "#WeeklyStats #Progress", status: "pending" },
    ],
    "Week 2": [
      { id: "w2-1", day: "Mon", type: "🏆 Success Story", caption: "Hard work pays off. Check out this incredible transformation and dedication.", hashtags: "#SuccessStory #HardWork", status: "pending" },
      { id: "w2-2", day: "Wed", type: "🌟 Coach Tip", caption: "Pro tip of the day from our expert coaches! Perfect your technique with this simple adjustment.", hashtags: "#CoachTip #ProTips", status: "pending" },
      { id: "w2-3", day: "Fri", type: "🎉 Fun Friday", caption: "Working hard but making sure we have fun while doing it! That's the spirit.", hashtags: "#FunFriday #TeamWork", status: "pending" },
    ],
    "Week 3": [
      { id: "w3-1", day: "Mon", type: "💪 Motivation Monday", caption: "\"Champions keep playing until they get it right.\" - Let's start the week strong!", hashtags: "#MotivationMonday #Inspiration", status: "pending" },
      { id: "w3-2", day: "Wed", type: "📸 Parent Testimonial", caption: "We love hearing from our parents! Thank you for trusting us with your child's journey.", hashtags: "#Testimonial #HappyParents", status: "pending" },
      { id: "w3-3", day: "Fri", type: "🏅 Achievement Unlock", caption: `Milestone reached! Celebrating our latest batch of achievers in ${mainSport}.`, hashtags: "#Achievement #Milestone", status: "pending" },
    ],
    "Week 4": [
      { id: "w4-1", day: "Mon", type: "📢 Enrollment Open", caption: `New ${mainSport} batches starting soon! Secure your spot today.`, hashtags: "#AdmissionsOpen #JoinUs", status: "pending" },
      { id: "w4-2", day: "Wed", type: "🎂 Birthday Week", caption: "Wishing a very Happy Birthday to all our students celebrating this month! Have a sporty year ahead.", hashtags: "#HappyBirthday #Celebration", status: "pending" },
      { id: "w4-3", day: "Fri", type: "🙏 Thank You", caption: "A huge thank you to all our dedicated coaches and supportive parents. We couldn't do it without you!", hashtags: "#ThankYou #Gratitude", status: "pending" },
    ],
  });

  const monthKey = new Date().toISOString().slice(0, 7);
  const storageKey = `content_calendar_${monthKey}`;

  const [content, setContent] = useState<Record<string, ContentItem[]>>(() => getInitialContent());

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setContent(JSON.parse(saved));
      } else {
        setContent(getInitialContent());
      }
    } catch (e) {
      console.error(e);
    }
  }, [storageKey, batches]);

  const toggleStatus = (week: string, id: string) => {
    setContent(prev => {
      const newWeek = prev[week].map(item => {
        if (item.id === id) {
          const nextStatus = item.status === 'pending' ? 'scheduled' : item.status === 'scheduled' ? 'posted' : 'pending';
          return { ...item, status: nextStatus as 'posted' | 'scheduled' | 'pending' };
        }
        return item;
      });
      const updated = { ...prev, [week]: newWeek };
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  };

  const copyText = (caption: string, hashtags: string) => {
    navigator.clipboard.writeText(`${caption}\n\n${hashtags}`);
  };

  const shareWhatsApp = (caption: string, hashtags: string) => {
    const text = encodeURIComponent(`${caption}\n\n${hashtags}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <Card className="bg-zinc-950 border-zinc-800 text-zinc-100">
      <CardHeader>
        <CardTitle>Content Calendar</CardTitle>
        <CardDescription className="text-zinc-400">Pre-built social media content for the entire month</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {Object.entries(content).map(([week, items]) => (
          <div key={week}>
            <h3 className="text-lg font-semibold text-lime-400 mb-4">{week}</h3>
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
              {items.map(item => (
                <div key={item.id} className="bg-zinc-900/40 p-4 rounded-lg border border-zinc-800 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-300 font-mono">
                      {item.day}
                    </Badge>
                    <button onClick={() => toggleStatus(week, item.id)} className="focus:outline-none hover:opacity-80 transition-opacity">
                      {item.status === 'posted' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                      {item.status === 'scheduled' && <Clock className="w-5 h-5 text-sky-500" />}
                      {item.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-zinc-600" />}
                    </button>
                  </div>
                  <h4 className="font-semibold text-zinc-200 mb-2">{item.type}</h4>
                  <p className="text-sm text-zinc-400 mb-2 flex-grow">{item.caption}</p>
                  <p className="text-xs text-sky-400 mb-4">{item.hashtags}</p>
                  
                  <div className="flex gap-2 mt-auto pt-2 border-t border-zinc-800/50">
                    <Button variant="ghost" size="sm" onClick={() => copyText(item.caption, item.hashtags)} className="flex-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800">
                      <Copy className="w-4 h-4 mr-2" /> Copy
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => shareWhatsApp(item.caption, item.hashtags)} className="flex-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30">
                      <Share2 className="w-4 h-4 mr-2" /> Share
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

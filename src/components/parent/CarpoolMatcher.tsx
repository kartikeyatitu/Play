"use client"
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface Parent {
  id: string;
  name: string;
  phone: string;
  area?: string;
}

export interface CarpoolMatcherProps {
  parents: Parent[];
  currentParentId: string;
}

export function CarpoolMatcher({ parents, currentParentId }: CarpoolMatcherProps) {
  const [myArea, setMyArea] = useState('');
  
  const otherParents = parents.filter(p => p.id !== currentParentId);

  return (
    <Card className="bg-zinc-900/50 border-zinc-800 text-zinc-100">
      <CardHeader>
        <CardTitle>Carpool Matcher</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm text-zinc-400">Your Area / Locality</label>
          <Input 
            value={myArea} 
            onChange={(e) => setMyArea(e.target.value)} 
            placeholder="e.g. Indiranagar, Jayanagar" 
            className="bg-zinc-950 border-zinc-800 text-zinc-100 mt-1"
          />
        </div>
        
        <div className="space-y-2 mt-4">
          <h3 className="text-sm font-medium text-zinc-400">Other Parents</h3>
          {otherParents.map(parent => {
            const message = `Hi! I'm from ${myArea || 'your area'} and my child goes to the same academy. Want to carpool?`;
            const waLink = `https://wa.me/91${parent.phone}?text=${encodeURIComponent(message)}`;
            
            return (
              <div key={parent.id} className="flex items-center justify-between p-3 bg-zinc-950 rounded-md border border-zinc-800">
                <div>
                  <div className="font-medium">{parent.name}</div>
                  {parent.area && <div className="text-xs text-zinc-500">{parent.area}</div>}
                </div>
                <Button 
                  variant="outline" 
                  className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100"
                  onClick={() => window.open(waLink, '_blank')}
                >
                  Connect on WhatsApp
                </Button>
              </div>
            );
          })}
          {otherParents.length === 0 && (
            <div className="text-zinc-500 text-sm">No other parents found.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

"use client"

import React, { useState } from 'react'

interface Match {
  id: string
  team1: string
  team2: string
  score1?: number
  score2?: number
  round: number
}

interface Tournament {
  name: string
  type: 'knockout' | 'league'
  teams: string[]
  matches: Match[]
}

export function TournamentBracket() {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [setup, setSetup] = useState({ name: '', type: 'knockout' as 'knockout' | 'league', teamsText: '' })
  
  const generateBracket = () => {
    const teams = setup.teamsText.split('\n').map(t => t.trim()).filter(t => t)
    if (teams.length < 2) return

    const matches: Match[] = []
    if (setup.type === 'knockout') {
      const shuffled = [...teams].sort(() => 0.5 - Math.random())
      let round = 1
      for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
          matches.push({ id: Date.now() + i.toString(), team1: shuffled[i], team2: shuffled[i+1], round })
        }
      }
    } else {
      // League: round robin
      let matchId = 0
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          matches.push({ id: Date.now() + (matchId++).toString(), team1: teams[i], team2: teams[j], round: 1 })
        }
      }
    }
    setTournament({ name: setup.name, type: setup.type, teams, matches })
  }

  const updateScore = (matchId: string, s1: string, s2: string) => {
    if (!tournament) return
    setTournament({
      ...tournament,
      matches: tournament.matches.map(m => m.id === matchId ? { ...m, score1: parseInt(s1) || 0, score2: parseInt(s2) || 0 } : m)
    })
  }

  const shareResults = () => {
    if (!tournament) return
    let text = `${tournament.name} Results:\n\n`
    tournament.matches.forEach(m => {
      text += `${m.team1} [${m.score1 ?? '-'}] vs [${m.score2 ?? '-'}] ${m.team2}\n`
    })
    navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
  }

  const renderLeagueTable = () => {
    if (!tournament) return null
    const stats: Record<string, { w: number, d: number, l: number, pts: number }> = {}
    tournament.teams.forEach(t => stats[t] = { w: 0, d: 0, l: 0, pts: 0 })
    
    tournament.matches.forEach(m => {
      if (m.score1 !== undefined && m.score2 !== undefined) {
        if (m.score1 > m.score2) { stats[m.team1].w++; stats[m.team1].pts += 3; stats[m.team2].l++ }
        else if (m.score1 < m.score2) { stats[m.team2].w++; stats[m.team2].pts += 3; stats[m.team1].l++ }
        else { stats[m.team1].d++; stats[m.team2].d++; stats[m.team1].pts += 1; stats[m.team2].pts += 1 }
      }
    })

    const sorted = Object.entries(stats).sort((a, b) => b[1].pts - a[1].pts)

    return (
      <table className="w-full text-left text-sm text-zinc-300 mt-4 border-collapse">
        <thead><tr className="border-b border-zinc-700 bg-zinc-800/50"><th className="p-2">Team</th><th className="p-2">W</th><th className="p-2">D</th><th className="p-2">L</th><th className="p-2">Pts</th></tr></thead>
        <tbody>
          {sorted.map(([team, s]) => (
            <tr key={team} className="border-b border-zinc-800"><td className="p-2 font-medium">{team}</td><td className="p-2">{s.w}</td><td className="p-2">{s.d}</td><td className="p-2">{s.l}</td><td className="p-2 font-bold text-sky-400">{s.pts}</td></tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="bg-zinc-900/50 p-6 rounded-lg text-zinc-100 border border-zinc-800">
      <h2 className="text-xl font-bold mb-4">Tournament Bracket Manager</h2>
      {!tournament ? (
        <div className="space-y-4 max-w-md">
          <input className="w-full bg-zinc-950 border border-zinc-800 p-2 rounded text-sm" placeholder="Tournament Name" value={setup.name} onChange={e => setSetup({...setup, name: e.target.value})} />
          <select className="w-full bg-zinc-950 border border-zinc-800 p-2 rounded text-sm" value={setup.type} onChange={e => setSetup({...setup, type: e.target.value as 'knockout'|'league'})}>
            <option value="knockout">Knockout</option>
            <option value="league">League</option>
          </select>
          <textarea className="w-full bg-zinc-950 border border-zinc-800 p-2 rounded text-sm h-32" placeholder="Enter teams (one per line)" value={setup.teamsText} onChange={e => setSetup({...setup, teamsText: e.target.value})} />
          <button className="bg-sky-600 px-4 py-2 rounded text-sm font-medium w-full" onClick={generateBracket}>Generate Tournament</button>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-sky-400">{tournament.name} ({tournament.type})</h3>
            <div className="space-x-2">
              <button className="bg-zinc-800 px-3 py-1 rounded text-sm" onClick={() => setTournament(null)}>Reset</button>
              <button className="bg-lime-600/20 text-lime-400 border border-lime-600/50 px-3 py-1 rounded text-sm" onClick={shareResults}>Share Results</button>
            </div>
          </div>
          
          <div className="space-y-4">
            {tournament.matches.map(m => (
              <div key={m.id} className="bg-zinc-950 p-3 rounded border border-zinc-800 flex items-center justify-between max-w-lg">
                <div className="flex-1 font-medium">{m.team1}</div>
                <div className="flex items-center gap-2 px-4">
                  <input type="number" className="bg-zinc-900 border border-zinc-700 w-12 text-center rounded text-sm" value={m.score1 ?? ''} onChange={e => updateScore(m.id, e.target.value, m.score2?.toString() ?? '')} />
                  <span className="text-zinc-500">-</span>
                  <input type="number" className="bg-zinc-900 border border-zinc-700 w-12 text-center rounded text-sm" value={m.score2 ?? ''} onChange={e => updateScore(m.id, m.score1?.toString() ?? '', e.target.value)} />
                </div>
                <div className="flex-1 font-medium text-right">{m.team2}</div>
              </div>
            ))}
          </div>
          
          {tournament.type === 'league' && renderLeagueTable()}
        </div>
      )}
    </div>
  )
}

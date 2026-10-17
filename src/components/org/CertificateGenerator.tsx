"use client"

import React, { useState } from 'react'

interface Student {
  id: string
  name: string
}

interface Props {
  students?: Student[]
  academyName?: string
}

export function CertificateGenerator({ students = [], academyName = 'Triq Academy' }: Props) {
  const [selectedStudent, setSelectedStudent] = useState(students[0]?.name || '')
  const [type, setType] = useState('completion')
  const [sport, setSport] = useState('Football')
  const [duration, setDuration] = useState('3 months')
  
  const handlePrint = () => {
    window.print()
  }

  const typeLabels: Record<string, string> = {
    completion: 'COMPLETION',
    excellence: 'EXCELLENCE',
    participation: 'PARTICIPATION'
  }

  return (
    <div className="bg-zinc-900/50 p-6 rounded-lg text-zinc-100 border border-zinc-800 flex flex-col md:flex-row gap-8">
      <div className="space-y-4 w-full md:w-1/3">
        <h2 className="text-xl font-bold mb-4">Certificate Generator</h2>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Student Name</label>
          <input className="w-full bg-zinc-950 border border-zinc-800 p-2 rounded text-sm" value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} placeholder="John Doe" />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Certificate Type</label>
          <select className="w-full bg-zinc-950 border border-zinc-800 p-2 rounded text-sm" value={type} onChange={e => setType(e.target.value)}>
            <option value="completion">Completion</option>
            <option value="excellence">Excellence</option>
            <option value="participation">Participation</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Sport</label>
          <input className="w-full bg-zinc-950 border border-zinc-800 p-2 rounded text-sm" value={sport} onChange={e => setSport(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Duration</label>
          <input className="w-full bg-zinc-950 border border-zinc-800 p-2 rounded text-sm" value={duration} onChange={e => setDuration(e.target.value)} />
        </div>
        <button className="bg-sky-600 px-4 py-2 rounded text-sm font-medium w-full mt-4" onClick={handlePrint}>Print Certificate</button>
      </div>
      
      <div className="w-full md:w-2/3 flex justify-center items-center bg-zinc-950 p-8 rounded border border-zinc-800 overflow-x-auto">
        {/* Printable area */}
        <div id="certificate-preview" className="bg-[#fff] text-[#000] p-12 border-8 border-double border-zinc-800 w-[800px] h-[600px] flex flex-col items-center justify-center text-center shadow-lg font-serif">
          <h1 className="text-4xl font-bold mb-2 uppercase text-zinc-800">Certificate of {typeLabels[type]}</h1>
          <p className="text-xl italic text-zinc-600 mb-8">This is to certify that</p>
          <h2 className="text-5xl font-bold mb-8 text-sky-900 border-b-2 border-zinc-300 pb-2 px-8 min-w-[300px]">{selectedStudent || '[STUDENT NAME]'}</h2>
          <p className="text-xl mb-2">has successfully completed {duration} of training in</p>
          <h3 className="text-3xl font-bold mb-8 text-zinc-800 uppercase">{sport}</h3>
          <p className="text-lg mb-12">at <strong>{academyName}</strong></p>
          
          <div className="flex justify-between w-full px-12 mt-auto">
            <div className="text-center">
              <div className="border-b border-black w-32 mb-1 h-8 flex items-end justify-center">{new Date().toLocaleDateString()}</div>
              <p className="text-sm">Date</p>
            </div>
            <div className="text-center">
              <div className="border-b border-black w-48 mb-1 h-8"></div>
              <p className="text-sm">Director / Head Coach</p>
            </div>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          #certificate-preview, #certificate-preview * { visibility: visible; }
          #certificate-preview { position: absolute; left: 0; top: 0; width: 100%; height: 100vh; border: none; box-shadow: none; }
        }
      `}} />
    </div>
  )
}

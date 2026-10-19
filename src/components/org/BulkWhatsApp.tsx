"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MESSAGE_TEMPLATES, WHATSAPP_CONFIG, generateWhatsAppLink, fillTemplate, WhatsAppTemplate } from "@/lib/whatsapp";
import { buildUpiLink, isValidUpiId, istMonthString } from "@/lib/fees";
import { MessageCircle, ExternalLink, Loader2, Send } from "lucide-react";

interface StudentData {
  id: string;
  name: string;
  parent: {
    name: string;
    phone: string;
  };
  hasPendingFees?: boolean;
  attendancePct?: number;
  batchName?: string;
}

interface BulkWhatsAppProps {
  students: StudentData[];
  academyName: string;
  /** Resolved monthly fee (₹) per student id — used for the {amount} variable */
  studentFees?: Record<string, number>;
  /** Academy UPI id — fills the {{pay_link}} slot in the Fee Reminder template */
  upiId?: string | null;
}

export function BulkWhatsApp({ students, academyName, studentFees = {}, upiId = null }: BulkWhatsAppProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  
  // Filters
  const [filterPendingFees, setFilterPendingFees] = useState(false);
  const [filterLowAttendance, setFilterLowAttendance] = useState(false);
  
  const [isSending, setIsSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [generatedLinks, setGeneratedLinks] = useState<{name: string, url: string}[]>([]);

  const selectedTemplate = MESSAGE_TEMPLATES.find(t => t.id === selectedTemplateId);
  const activeTemplates = MESSAGE_TEMPLATES.filter(t => t.isActive);

  // Apply filters to get available students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (filterPendingFees && !s.hasPendingFees) return false;
      if (filterLowAttendance && (s.attendancePct === undefined || s.attendancePct >= 70)) return false;
      return true;
    });
  }, [students, filterPendingFees, filterLowAttendance]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudentIds(new Set(filteredStudents.map(s => s.id)));
    } else {
      setSelectedStudentIds(new Set());
    }
  };

  const handleSelectStudent = (id: string, checked: boolean) => {
    const newSet = new Set(selectedStudentIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedStudentIds(newSet);
  };

  const getPreviewMessage = (student: StudentData, template: WhatsAppTemplate) => {
    const amount = studentFees[student.id] || 0;
    const monthStr = istMonthString();
    // Resolve {{pay_link}}: UPI deep link if the academy has a valid UPI ID, else a plain
    // "pay cash / bank transfer" line so the template still reads clean.
    const payLine = (() => {
      if (upiId && isValidUpiId(upiId) && amount > 0) {
        const link = buildUpiLink({
          upiId,
          payeeName: academyName,
          amount,
          note: `${student.name} fee ${monthStr}`,
        });
        return `Pay via UPI: ${link}\n(or UPI ID: ${upiId})`;
      }
      if (upiId && isValidUpiId(upiId)) {
        return `Pay via UPI: ${upiId}`;
      }
      return "Please pay by cash or bank transfer and let us know once done.";
    })();

    const vars: Record<string, string> = {
      parent_name: student.parent.name,
      student_name: student.name,
      academy_name: academyName,
      // Mock some vars that might be needed based on template
      amount: amount > 0 ? String(amount) : "—",
      month: new Date().toLocaleString('default', { month: 'long' }),
      date: new Date().toLocaleDateString(),
      batch_name: student.batchName || "Regular Batch",
      schedule: "Mon/Wed/Fri",
      coach_name: "Head Coach",
      technique: "4",
      fitness: "4",
      discipline: "5",
      attendance: student.attendancePct?.toString() || "85",
      notes: "Progressing well.",
      pay_link: payLine,
    };
    return fillTemplate(template.body, vars);
  };

  const handleSend = async () => {
    if (!selectedTemplate || selectedStudentIds.size === 0) return;

    setIsSending(true);
    setSentCount(0);
    setGeneratedLinks([]);

    const studentsToSend = students.filter(s => selectedStudentIds.has(s.id));

    // There is no WhatsApp Business API integration yet, so we never claim to have "sent" anything.
    // Instead we build one tap-to-send wa.me link per parent; the admin taps each to send from their own WhatsApp.
    const links = studentsToSend.map(s => ({
      name: s.parent.name,
      url: generateWhatsAppLink(s.parent.phone, getPreviewMessage(s, selectedTemplate))
    }));
    setGeneratedLinks(links);
    setIsSending(false);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-950 border-zinc-800 text-zinc-100">
        <CardHeader>
          <CardTitle className="text-xl">Bulk WhatsApp Messaging</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Select Message Template</Label>
            <Select value={selectedTemplateId} onValueChange={(v) => setSelectedTemplateId(v || "")}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800">
                <SelectValue placeholder="Choose a template..." />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                {activeTemplates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplate && (
            <div className="bg-zinc-900/40 p-4 rounded-md border border-zinc-800">
              <Label className="text-zinc-400 mb-2 block">Message Preview (First Recipient)</Label>
              <p className="whitespace-pre-wrap text-sm text-zinc-300 font-mono">
                {filteredStudents.length > 0 
                  ? getPreviewMessage(filteredStudents[0], selectedTemplate)
                  : "Select recipients to see preview"}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <Label>Filters</Label>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="filter-fees" 
                  checked={filterPendingFees} 
                  onCheckedChange={(c) => setFilterPendingFees(c as boolean)} 
                />
                <label htmlFor="filter-fees" className="text-sm cursor-pointer">Only Pending Fees</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="filter-attendance" 
                  checked={filterLowAttendance} 
                  onCheckedChange={(c) => setFilterLowAttendance(c as boolean)} 
                />
                <label htmlFor="filter-attendance" className="text-sm cursor-pointer">Only Low Attendance ({"<"}70%)</label>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="select-all" 
                  checked={filteredStudents.length > 0 && selectedStudentIds.size === filteredStudents.length}
                  onCheckedChange={(c) => handleSelectAll(c as boolean)}
                />
                <label htmlFor="select-all" className="font-medium">Select All ({filteredStudents.length})</label>
              </div>
              <span className="text-sm text-zinc-400">{selectedStudentIds.size} selected</span>
            </div>
            
            <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
              {filteredStudents.map(student => (
                <div key={student.id} className="flex items-center justify-between bg-zinc-900/30 p-2 rounded border border-zinc-800/50">
                  <div className="flex items-center space-x-3">
                    <Checkbox 
                      id={`student-${student.id}`} 
                      checked={selectedStudentIds.has(student.id)}
                      onCheckedChange={(c) => handleSelectStudent(student.id, c as boolean)}
                    />
                    <div>
                      <p className="text-sm font-medium">{student.parent.name}</p>
                      <p className="text-xs text-zinc-400">Parent of {student.name}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {student.parent.phone}
                  </Badge>
                </div>
              ))}
              {filteredStudents.length === 0 && (
                <p className="text-center text-zinc-500 py-4 text-sm">No students match the current filters.</p>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex-col items-stretch space-y-4 pt-4 border-t border-zinc-800">
          <Button 
            className="w-full bg-cyan-600 hover:bg-cyan-700" 
            disabled={!selectedTemplate || selectedStudentIds.size === 0 || isSending}
            onClick={handleSend}
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Preparing messages...
              </>
            ) : (
              <><MessageCircle className="w-4 h-4 mr-2" /> Prepare WhatsApp messages for {selectedStudentIds.size} Parents</>
            )}
          </Button>

          {generatedLinks.length > 0 && (
            <div className="bg-amber-950/20 border border-amber-900/50 rounded-md p-4 space-y-3">
              <p className="text-amber-400 text-sm font-medium">
                {generatedLinks.length} messages ready. Nothing has been sent yet. Tap each parent below to open WhatsApp with the message filled in, then press Send there:
              </p>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {generatedLinks.map((link, i) => (
                  <div key={i} className="flex items-center justify-between bg-zinc-900/50 p-2 rounded">
                    <span className="text-sm">{link.name}</span>
                    <Button size="sm" variant="secondary" onClick={() => window.open(link.url, "_blank")}>
                      <ExternalLink className="w-3 h-3 mr-1" /> Open
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

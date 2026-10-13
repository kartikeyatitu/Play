"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MESSAGE_TEMPLATES, WHATSAPP_CONFIG, generateWhatsAppLink, fillTemplate, WhatsAppTemplate } from "@/lib/whatsapp";
import { AlertCircle, CheckCircle2, Copy, Edit2, ExternalLink, Save, X } from "lucide-react";

export function WhatsAppTemplates() {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(MESSAGE_TEMPLATES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("whatsapp_templates");
      if (saved) {
        const parsedSaved = JSON.parse(saved);
        // Merge saved body and isActive status into the config templates
        setTemplates(MESSAGE_TEMPLATES.map(t => {
          const s = parsedSaved.find((p: any) => p.id === t.id);
          if (s) {
            return { ...t, body: s.body, isActive: s.isActive };
          }
          return t;
        }));
      }
    } catch (e) {
      console.error("Failed to load templates from local storage", e);
    }
  }, []);

  const saveToLocalStorage = (newTemplates: WhatsAppTemplate[]) => {
    try {
      const toSave = newTemplates.map(t => ({ id: t.id, body: t.body, isActive: t.isActive }));
      localStorage.setItem("whatsapp_templates", JSON.stringify(toSave));
    } catch (e) {
      console.error("Failed to save templates", e);
    }
  };

  const handleEdit = (template: WhatsAppTemplate) => {
    setEditingId(template.id);
    setEditBody(template.body);
  };

  const handleSave = (id: string) => {
    const updated = templates.map(t => t.id === id ? { ...t, body: editBody } : t);
    setTemplates(updated);
    saveToLocalStorage(updated);
    setEditingId(null);
  };

  const handleToggleActive = (id: string) => {
    const updated = templates.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t);
    setTemplates(updated);
    saveToLocalStorage(updated);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const getTestVariables = (template: WhatsAppTemplate) => {
    const dummyData: Record<string, string> = {
      parent_name: "Rahul Sharma",
      student_name: "Aarav",
      amount: "2500",
      month: "October",
      academy_name: "Elite Sports Academy",
      date: new Date().toLocaleDateString(),
      batch_name: "U-12 Football",
      schedule: "Mon/Wed/Fri 5 PM",
      coach_name: "Coach John",
      technique: "4",
      fitness: "5",
      discipline: "4",
      attendance: "85",
      notes: "Doing great, needs to work on stamina.",
    };

    const vars: Record<string, string> = {};
    template.variables.forEach(v => {
      vars[v] = dummyData[v] || "___";
    });
    return vars;
  };

  const highlightVariables = (text: string) => {
    const parts = text.split(/(\{\{[^}]+\}\})/g);
    return (
      <>
        {parts.map((part, i) => {
          if (part.startsWith("{{") && part.endsWith("}}")) {
            return (
              <span key={i} className="text-cyan-400 font-medium">
                {part}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </>
    );
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      fee_reminder: "rose",
      attendance_alert: "amber",
      birthday_wish: "purple",
      announcement: "sky",
      welcome: "emerald",
      trial_followup: "lime",
    };
    return (colors[category] || "default") as any;
  };

  return (
    <div className="space-y-8 text-zinc-100">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">WhatsApp Templates</h2>
          <p className="text-zinc-400">Manage your message templates for automated communication.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <Card key={template.id} className="bg-zinc-950 border-zinc-800 flex flex-col opacity-100 transition-opacity" style={{ opacity: template.isActive ? 1 : 0.6 }}>
            <CardHeader className="pb-3 flex flex-row justify-between items-start space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-lg">{template.name}</CardTitle>
                <Badge variant={getCategoryColor(template.category)}>
                  {template.category.replace("_", " ")}
                </Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  checked={template.isActive} 
                  onCheckedChange={() => handleToggleActive(template.id)} 
                  title={template.isActive ? "Active" : "Inactive"}
                />
              </div>
            </CardHeader>
            <CardContent className="flex-1 pb-4">
              {editingId === template.id ? (
                <Textarea
                  value={editBody}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditBody(e.target.value)}
                  className="min-h-[200px] font-mono text-sm bg-zinc-900/50 border-zinc-800 focus-visible:ring-cyan-500"
                />
              ) : (
                <div className="bg-zinc-900/40 p-4 rounded-md min-h-[200px] whitespace-pre-wrap text-sm border border-zinc-800/50">
                  {highlightVariables(template.body)}
                </div>
              )}
            </CardContent>
            <CardFooter className="pt-0 flex justify-between border-t border-zinc-800/50 mt-4 px-6 py-4">
              {editingId === template.id ? (
                <div className="flex space-x-2 w-full">
                  <Button size="sm" variant="outline" className="flex-1 bg-transparent hover:bg-zinc-800" onClick={() => setEditingId(null)}>
                    <X className="w-4 h-4 mr-2" /> Cancel
                  </Button>
                  <Button size="sm" className="flex-1 bg-cyan-600 hover:bg-cyan-700" onClick={() => handleSave(template.id)}>
                    <Save className="w-4 h-4 mr-2" /> Save
                  </Button>
                </div>
              ) : (
                <div className="flex space-x-2 w-full">
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="bg-transparent hover:bg-zinc-800 border-zinc-700 text-zinc-300 h-9 w-9" 
                    title="Edit Template"
                    onClick={() => handleEdit(template)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="bg-transparent hover:bg-zinc-800 border-zinc-700 text-zinc-300 h-9 w-9" 
                    title="Copy Template"
                    onClick={() => handleCopy(template.body)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white"
                    onClick={() => {
                      const msg = fillTemplate(template.body, getTestVariables(template));
                      window.open(generateWhatsAppLink("919876543210", msg), "_blank");
                    }}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" /> Send Test
                  </Button>
                </div>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      <Card className="bg-zinc-950 border-zinc-800 mt-12">
        <CardHeader>
          <CardTitle className="text-xl flex items-center">
            Automation Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {WHATSAPP_CONFIG.isConfigured ? (
            <div className="flex items-start space-x-4 bg-emerald-950/20 border border-emerald-900/50 p-4 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-emerald-400 font-semibold text-lg">WhatsApp Business API connected</h4>
                <p className="text-emerald-300/80 mt-1">Messages are sent automatically to parents based on system events.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start space-x-4 bg-amber-950/20 border border-amber-900/50 p-4 rounded-lg">
              <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-amber-400 font-semibold text-lg">WhatsApp Business API not configured</h4>
                <p className="text-amber-300/80 mt-1">Currently using manual WhatsApp links (wa.me).</p>
                
                <div className="mt-4 pt-4 border-t border-amber-900/30">
                  <p className="text-amber-200/90 font-medium mb-2">To enable automatic messages:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-amber-300/70">
                    <li>Create a Meta Business account</li>
                    <li>Set up WhatsApp Business API</li>
                    <li>Add WHATSAPP_ACCESS_TOKEN to your .env file</li>
                    <li>Messages will be sent automatically!</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

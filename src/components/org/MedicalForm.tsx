"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Printer, HeartPulse } from "lucide-react";
import { updateMedicalInfo } from "@/app/actions/medical";

interface MedicalFormProps {
  student: {
    id: string;
    name: string;
    bloodGroup?: string | null;
    medicalInfo?: string | null;
    [key: string]: any;
  };
}

export function MedicalForm({ student }: MedicalFormProps) {
  const [isSubmitting, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  
  // Parse existing medical info
  let initialMedicalInfo: any = {};
  if (student.medicalInfo) {
    try {
      initialMedicalInfo = JSON.parse(student.medicalInfo);
    } catch (e) {
      console.error("Failed to parse medical info", e);
    }
  }

  const [formData, setFormData] = useState({
    bloodGroup: student.bloodGroup || "",
    allergies: initialMedicalInfo.allergies || "",
    medicalConditions: initialMedicalInfo.medicalConditions || "",
    emergencyContactName: initialMedicalInfo.emergencyContactName || "",
    emergencyContactPhone: initialMedicalInfo.emergencyContactPhone || "",
    doctorName: initialMedicalInfo.doctorName || "",
    doctorPhone: initialMedicalInfo.doctorPhone || "",
    insurancePolicyNumber: initialMedicalInfo.insurancePolicyNumber || "",
    signature: initialMedicalInfo.signature || "",
    consent: initialMedicalInfo.consent || false
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.consent || !formData.signature) {
      alert("Please provide consent and digital signature.");
      return;
    }
    
    startTransition(async () => {
      const res = await updateMedicalInfo(student.id, formData);
      if (res.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        alert(res.error || "Failed to update medical info");
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Card className="bg-zinc-950 border-zinc-800 max-w-3xl mx-auto print:bg-white print:text-black print:border-none print:shadow-none">
      <CardHeader className="border-b border-zinc-900 pb-6 print:border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HeartPulse className="h-6 w-6 text-rose-500 print:text-black" />
            <div>
              <CardTitle className="text-xl text-zinc-100 print:text-black">Medical & Waiver Form</CardTitle>
              <CardDescription className="text-zinc-500 print:text-gray-600">
                Emergency information for {student.name}
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePrint}
            className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 print:hidden"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print Waiver
          </Button>
        </div>
      </CardHeader>
      
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="bloodGroup" className="text-zinc-300 print:text-black">Blood Group</Label>
              <select 
                id="bloodGroup"
                value={formData.bloodGroup}
                onChange={(e) => handleChange("bloodGroup", e.target.value)}
                className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 print:border-gray-300 print:bg-white print:text-black"
              >
                <option value="">Select Blood Group</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="allergies" className="text-zinc-300 print:text-black">Allergies (if any)</Label>
              <Input 
                id="allergies" 
                placeholder="e.g., Peanuts, Penicillin"
                value={formData.allergies}
                onChange={(e) => handleChange("allergies", e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-zinc-100 print:border-gray-300 print:bg-white print:text-black print:placeholder-transparent"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="medicalConditions" className="text-zinc-300 print:text-black">Existing Medical Conditions</Label>
            <Input 
              id="medicalConditions" 
              placeholder="e.g., Asthma, Diabetes"
              value={formData.medicalConditions}
              onChange={(e) => handleChange("medicalConditions", e.target.value)}
              className="bg-zinc-950 border-zinc-800 text-zinc-100 print:border-gray-300 print:bg-white print:text-black print:placeholder-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-900 print:border-gray-200">
            <div className="space-y-2">
              <Label htmlFor="emergencyContactName" className="text-zinc-300 print:text-black">Emergency Contact Name *</Label>
              <Input 
                id="emergencyContactName" 
                required
                value={formData.emergencyContactName}
                onChange={(e) => handleChange("emergencyContactName", e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-zinc-100 print:border-gray-300 print:bg-white print:text-black"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="emergencyContactPhone" className="text-zinc-300 print:text-black">Emergency Contact Phone *</Label>
              <Input 
                id="emergencyContactPhone" 
                type="tel"
                required
                value={formData.emergencyContactPhone}
                onChange={(e) => handleChange("emergencyContactPhone", e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-zinc-100 print:border-gray-300 print:bg-white print:text-black"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="doctorName" className="text-zinc-300 print:text-black">Physician/Doctor Name</Label>
              <Input 
                id="doctorName" 
                value={formData.doctorName}
                onChange={(e) => handleChange("doctorName", e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-zinc-100 print:border-gray-300 print:bg-white print:text-black"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="doctorPhone" className="text-zinc-300 print:text-black">Physician/Doctor Phone</Label>
              <Input 
                id="doctorPhone" 
                type="tel"
                value={formData.doctorPhone}
                onChange={(e) => handleChange("doctorPhone", e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-zinc-100 print:border-gray-300 print:bg-white print:text-black"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="insurancePolicyNumber" className="text-zinc-300 print:text-black">Insurance Policy Number (Optional)</Label>
            <Input 
              id="insurancePolicyNumber" 
              value={formData.insurancePolicyNumber}
              onChange={(e) => handleChange("insurancePolicyNumber", e.target.value)}
              className="bg-zinc-950 border-zinc-800 text-zinc-100 print:border-gray-300 print:bg-white print:text-black"
            />
          </div>

          <div className="pt-6 border-t border-zinc-900 print:border-gray-200 space-y-4">
            <div className="flex items-start space-x-3">
              <input 
                type="checkbox"
                id="consent" 
                checked={formData.consent}
                onChange={(e) => handleChange("consent", e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-rose-500 print:border-black"
              />
              <div className="space-y-1">
                <Label htmlFor="consent" className="text-sm font-medium text-zinc-300 leading-tight cursor-pointer print:text-black">
                  Medical Consent & Authorization
                </Label>
                <p className="text-sm text-zinc-500 print:text-gray-700">
                  I confirm the above medical information is accurate and authorize the academy to use it in emergencies. 
                  I consent to emergency medical treatment for the student if I cannot be reached.
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2">
                <Label htmlFor="signature" className="text-zinc-300 print:text-black">Digital Signature (Type Full Name) *</Label>
                <Input 
                  id="signature" 
                  required
                  placeholder="Parent / Guardian Name"
                  value={formData.signature}
                  onChange={(e) => handleChange("signature", e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-zinc-100 font-medium print:border-gray-300 print:bg-white print:text-black"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300 print:text-black">Date</Label>
                <div className="h-10 px-3 py-2 border border-zinc-800 rounded-md bg-zinc-900/50 text-zinc-400 text-sm flex items-center print:border-gray-300 print:bg-white print:text-black">
                  {new Date().toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-zinc-900/30 border-t border-zinc-900 px-6 py-4 print:hidden">
          <Button 
            type="submit" 
            disabled={isSubmitting || !formData.consent || !formData.signature}
            className="w-full sm:w-auto bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
          >
            {isSubmitting ? "Saving..." : saved ? "Saved Successfully!" : "Save Medical Information"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { convertTrialToStudent, updateTrialStatus } from "@/app/actions/trial-convert";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Phone, User, CheckCircle2 } from "lucide-react";

export function TrialManager({ trials }: { trials: any[] }) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleConvert = async (trialId: string) => {
    try {
      setLoading(trialId);
      await convertTrialToStudent(trialId);
      toast.success("Trial converted to Student!");
    } catch (e: any) {
      toast.error(e.message || "Failed to convert trial");
    } finally {
      setLoading(null);
    }
  };

  const handleStatusChange = async (trialId: string, status: string) => {
    try {
      setLoading(trialId);
      await updateTrialStatus(trialId, status);
      toast.success("Status updated");
    } catch (e: any) {
      toast.error(e.message || "Failed to update status");
    } finally {
      setLoading(null);
    }
  };

  if (!trials || trials.length === 0) {
    return (
      <Card className="bg-zinc-900/30 border-zinc-800/50">
        <CardContent className="p-8 text-center text-zinc-500">
          No trial bookings found.
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'PENDING': return 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30';
      case 'CONFIRMED': return 'bg-blue-500/20 text-blue-500 hover:bg-blue-500/30';
      case 'COMPLETED': return 'bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30';
      case 'ENROLLED': return 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30';
      case 'NO_SHOW': return 'bg-rose-500/20 text-rose-500 hover:bg-rose-500/30';
      default: return 'bg-zinc-800 text-zinc-300';
    }
  };

  return (
    <Card className="bg-zinc-900/30 border-zinc-800/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800/50 bg-zinc-900/40 hover:bg-zinc-900/40">
            <TableHead className="text-zinc-500 text-xs uppercase">Child / Parent</TableHead>
            <TableHead className="text-zinc-500 text-xs uppercase">Contact</TableHead>
            <TableHead className="text-zinc-500 text-xs uppercase">Batch & Date</TableHead>
            <TableHead className="text-zinc-500 text-xs uppercase">Status</TableHead>
            <TableHead className="text-zinc-500 text-xs uppercase text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trials.map(trial => (
            <TableRow key={trial.id} className="border-zinc-800/30 hover:bg-zinc-800/20">
              <TableCell>
                <div className="font-medium text-zinc-200">{trial.childName} (Age {trial.childAge})</div>
                <div className="text-xs text-zinc-500 flex items-center mt-1">
                  <User className="w-3 h-3 mr-1" /> {trial.parentName}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm text-zinc-300 flex items-center">
                  <Phone className="w-3 h-3 mr-1" /> {trial.parentPhone}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm text-zinc-300">{trial.batch?.name || "Unknown Batch"}</div>
                <div className="text-xs text-zinc-500 flex items-center mt-1">
                  <Calendar className="w-3 h-3 mr-1" /> {new Date(trial.date).toLocaleDateString()}
                </div>
              </TableCell>
              <TableCell>
                <Badge className={getStatusColor(trial.status)} variant="outline">
                  {trial.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {trial.status === 'PENDING' && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 text-xs h-7"
                      onClick={() => handleStatusChange(trial.id, 'CONFIRMED')}
                      disabled={loading === trial.id}
                    >
                      Confirm
                    </Button>
                  )}
                  {trial.status === 'CONFIRMED' && (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs h-7"
                        onClick={() => handleStatusChange(trial.id, 'COMPLETED')}
                        disabled={loading === trial.id}
                      >
                        Mark Done
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs h-7"
                        onClick={() => handleStatusChange(trial.id, 'NO_SHOW')}
                        disabled={loading === trial.id}
                      >
                        No Show
                      </Button>
                    </>
                  )}
                  {(trial.status === 'COMPLETED' || trial.status === 'CONFIRMED') && (
                    <Button 
                      size="sm" 
                      className="bg-purple-500 hover:bg-purple-600 text-zinc-950 font-bold text-xs h-7"
                      onClick={() => handleConvert(trial.id)}
                      disabled={loading === trial.id || trial.status === 'ENROLLED'} // Using a dummy state if we had one
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Convert to Student
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

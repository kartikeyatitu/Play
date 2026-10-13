"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createFacility, deleteFacility, createEquipment, deleteEquipment } from "@/app/actions/facilities";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function FacilitiesTab({ facilities, equipment }: { facilities: any[], equipment: any[] }) {
  const router = useRouter();
  const [facilityName, setFacilityName] = useState("");
  const [facilityType, setFacilityType] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentQuantity, setEquipmentQuantity] = useState("");
  const [equipmentCondition, setEquipmentCondition] = useState("");

  const handleAddFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    await createFacility(facilityName, facilityType);
    toast.success("Facility added");
    setFacilityName("");
    setFacilityType("");
    router.refresh();
  };

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    await createEquipment(equipmentName, parseInt(equipmentQuantity), equipmentCondition);
    toast.success("Equipment added");
    setEquipmentName("");
    setEquipmentQuantity("");
    setEquipmentCondition("");
    router.refresh();
  };

  const handleDeleteFacility = async (id: string) => {
    await deleteFacility(id);
    toast.success("Facility deleted");
    router.refresh();
  };

  const handleDeleteEquipment = async (id: string) => {
    await deleteEquipment(id);
    toast.success("Equipment deleted");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="bg-zinc-900/40 border-zinc-800">
        <CardHeader>
          <CardTitle>Facilities & Courts</CardTitle>
          <CardDescription>Manage active turfs and courts</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddFacility} className="flex gap-2 mb-4">
            <Input placeholder="Name" value={facilityName} onChange={e => setFacilityName(e.target.value)} className="bg-zinc-950 border-zinc-800 text-zinc-100" required />
            <Input placeholder="Type" value={facilityType} onChange={e => setFacilityType(e.target.value)} className="bg-zinc-950 border-zinc-800 text-zinc-100" required />
            <Button type="submit" variant="default" className="bg-lime-500 text-zinc-950 hover:bg-lime-600">Add</Button>
          </form>
          <div className="space-y-4">
            {facilities.length === 0 ? (
              <p className="text-sm text-zinc-500">No facilities configured.</p>
            ) : (
              facilities.map(fac => (
                <div key={fac.id} className="flex justify-between items-center p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                  <div>
                    <p className="font-bold text-zinc-100">{fac.name}</p>
                    <p className="text-xs text-zinc-500">{fac.type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-emerald-400 border-emerald-400/20 bg-emerald-400/10">Available</Badge>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteFacility(fac.id)} className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/40 border-zinc-800">
        <CardHeader>
          <CardTitle>Equipment Inventory</CardTitle>
          <CardDescription>Track footballs, cones, and gear</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddEquipment} className="flex gap-2 mb-4">
            <Input placeholder="Name" value={equipmentName} onChange={e => setEquipmentName(e.target.value)} className="bg-zinc-950 border-zinc-800 text-zinc-100" required />
            <Input type="number" placeholder="Qty" value={equipmentQuantity} onChange={e => setEquipmentQuantity(e.target.value)} className="bg-zinc-950 border-zinc-800 text-zinc-100 w-20" required />
            <Input placeholder="Condition" value={equipmentCondition} onChange={e => setEquipmentCondition(e.target.value)} className="bg-zinc-950 border-zinc-800 text-zinc-100" required />
            <Button type="submit" variant="default" className="bg-lime-500 text-zinc-950 hover:bg-lime-600">Add</Button>
          </form>
          <div className="space-y-4">
            {equipment.length === 0 ? (
              <p className="text-sm text-zinc-500">No equipment tracked.</p>
            ) : (
              equipment.map(item => (
                <div key={item.id} className="flex justify-between items-center p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                  <div>
                    <p className="font-bold text-zinc-100">{item.name}</p>
                    <p className="text-xs text-zinc-500">{item.assignedTo ? `Assigned to: ${item.assignedTo.name}` : 'In Storage'}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-black text-cyan-400">x{item.quantity}</span>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteEquipment(item.id)} className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

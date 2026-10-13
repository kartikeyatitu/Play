"use client";

import { useState } from "react";
import { createRoute, deleteRoute } from "@/app/actions/transport";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Trash2, Share2, Bus, MapPin, Users } from "lucide-react";

interface RouteData {
  id: string;
  name: string;
  driverName: string;
  driverPhone: string;
  vehicleNumber: string;
  stops: string[];
  studentNames: string[];
}

interface TransportManagerProps {
  initialRoutes: RouteData[];
}

export function TransportManager({ initialRoutes }: TransportManagerProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
  const [name, setName] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [stopsStr, setStopsStr] = useState("");
  const [studentsStr, setStudentsStr] = useState("");

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !driverName || !vehicleNumber) return;
    
    setIsLoading(true);
    const stops = stopsStr.split(",").map(s => s.trim()).filter(s => s);
    const studentNames = studentsStr.split(",").map(s => s.trim()).filter(s => s);
    
    try {
      await createRoute({
        name,
        driverName,
        driverPhone,
        vehicleNumber,
        stops,
        studentNames,
      });
      toast.success("Transport route added");
      setName("");
      setDriverName("");
      setDriverPhone("");
      setVehicleNumber("");
      setStopsStr("");
      setStudentsStr("");
      router.refresh();
    } catch (error) {
      toast.error("Failed to add route");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRoute = async (id: string) => {
    try {
      await deleteRoute(id);
      toast.success("Route deleted");
      router.refresh();
    } catch (error) {
      toast.error("Failed to delete route");
    }
  };

  const handleShare = (route: RouteData) => {
    const text = `Transport Route: ${route.name}\nDriver: ${route.driverName} (${route.driverPhone})\nVehicle: ${route.vehicleNumber}\nStops: ${route.stops.join(" -> ")}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-950 border-zinc-800 text-zinc-100">
        <CardHeader>
          <CardTitle>Create New Route</CardTitle>
          <CardDescription className="text-zinc-400">Manage transport routes for students.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateRoute} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input placeholder="Route Name (e.g. Downtown)" value={name} onChange={(e) => setName(e.target.value)} className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500" required />
              <Input placeholder="Vehicle Number" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500" required />
              <Input placeholder="Driver Name" value={driverName} onChange={(e) => setDriverName(e.target.value)} className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500" required />
              <Input placeholder="Driver Phone" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500" />
            </div>
            <Input placeholder="Stops (comma separated)" value={stopsStr} onChange={(e) => setStopsStr(e.target.value)} className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500" />
            <Input placeholder="Students (comma separated)" value={studentsStr} onChange={(e) => setStudentsStr(e.target.value)} className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500" />
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Creating..." : "Create Route"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {initialRoutes.map((route) => (
          <Card key={route.id} className="bg-zinc-950 border-zinc-800 text-zinc-100">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Bus className="h-5 w-5 text-zinc-400" /> {route.name}
                  </CardTitle>
                  <CardDescription className="text-zinc-400 mt-1">
                    {route.vehicleNumber} • {route.driverName} ({route.driverPhone})
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-zinc-400 flex items-center gap-2 mb-2"><MapPin className="h-4 w-4" /> Stops</h4>
                <div className="flex flex-wrap gap-2">
                  {route.stops.map((stop, i) => (
                    <span key={i} className="text-xs bg-zinc-900 px-2 py-1 rounded border border-zinc-800 text-zinc-300">{stop}</span>
                  ))}
                  {route.stops.length === 0 && <span className="text-xs text-zinc-500">No stops defined</span>}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-zinc-400 flex items-center gap-2 mb-2"><Users className="h-4 w-4" /> Students</h4>
                <div className="flex flex-wrap gap-2">
                  {route.studentNames.map((student, i) => (
                    <span key={i} className="text-xs bg-zinc-900 px-2 py-1 rounded border border-zinc-800 text-zinc-300">{student}</span>
                  ))}
                  {route.studentNames.length === 0 && <span className="text-xs text-zinc-500">No students assigned</span>}
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-0 flex justify-between">
              <Button variant="outline" size="sm" onClick={() => handleShare(route)} className="border-zinc-800 text-zinc-100 hover:bg-zinc-900">
                <Share2 className="h-4 w-4 mr-2" /> WhatsApp Share
              </Button>
              <Button variant="destructive" size="sm" onClick={() => handleDeleteRoute(route.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

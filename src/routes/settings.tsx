import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Calculator, MapPin, Save, ShieldCheck, QrCode, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/settings")({ 
  component: () => (
    <AppShell>
      <SettingsPage />
    </AppShell>
  ) 
});

function SettingsPage() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [busy, setBusy] = useState(false);

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_settings" as any).select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: locations = [], isLoading: loadingLocations } = useQuery({
    queryKey: ["company-locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_locations" as any).select("*").order("name");
      if (error) return [];
      return data;
    },
  });

  const [formData, setFormData] = useState<any>({});
  const [newLoc, setNewLoc] = useState({ name: "", address: "", lat: "", lng: "" });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const handleSaveSettings = async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("company_settings" as any)
        .upsert({ ...formData, updated_at: new Date().toISOString() });
      
      if (error) throw error;
      toast.success("General settings updated!");
      qc.invalidateQueries({ queryKey: ["company-settings"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setBusy(false);
    }
  };

  const handleAddLocation = async () => {
    if (!newLoc.name || !newLoc.lat || !newLoc.lng) return toast.error("Please fill required location fields.");
    try {
      const { error } = await supabase.from("company_locations" as any).insert({
        name: newLoc.name,
        address: newLoc.address,
        lat: Number(newLoc.lat),
        lng: Number(newLoc.lng)
      });
      if (error) throw error;
      toast.success("New location added!");
      setNewLoc({ name: "", address: "", lat: "", lng: "" });
      qc.invalidateQueries({ queryKey: ["company-locations"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    try {
      const { error } = await supabase.from("company_locations" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Location removed");
      qc.invalidateQueries({ queryKey: ["company-locations"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loadingSettings) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading settings...</div>;
  if (!isAdmin) return <div className="p-8 text-center text-destructive font-bold">Access Denied: Admins Only.</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight text-foreground">Settings</h1>
          <p className="text-muted-foreground font-medium mt-1">Manage global rules and multi-office infrastructure.</p>
        </div>
        <Button onClick={handleSaveSettings} disabled={busy} className="gap-2 px-8 h-12 rounded-xl shadow-lg shadow-primary/20">
          <Save className="size-4" /> {busy ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8 h-14 bg-muted/50 p-1.5 rounded-2xl">
          <TabsTrigger value="general" className="rounded-xl font-bold gap-2 data-[state=active]:shadow-md">
            <Building2 className="size-4" /> General
          </TabsTrigger>
          <TabsTrigger value="payroll" className="rounded-xl font-bold gap-2 data-[state=active]:shadow-md">
            <Calculator className="size-4" /> Payroll Rules
          </TabsTrigger>
          <TabsTrigger value="location" className="rounded-xl font-bold gap-2 data-[state=active]:shadow-md">
            <MapPin className="size-4" /> Office Locations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle>Company Identity</CardTitle>
              <CardDescription>Basic information about your organization.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Company Name</Label>
                  <Input name="company_name" value={formData.company_name || ""} onChange={handleChange} className="h-12 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Company Logo URL</Label>
                  <Input name="company_logo_url" value={formData.company_logo_url || ""} onChange={handleChange} className="h-12 rounded-xl" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll" className="space-y-6">
          <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle>Statutory Contribution Rates</CardTitle>
              <CardDescription>Configure PF, ESI, and PT thresholds.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid gap-8 md:grid-cols-2">
                <section className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2"><ShieldCheck className="size-4" /> Provident Fund (PF)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-muted-foreground">Employer Share (%)</Label>
                      <Input type="number" step="0.01" name="pf_rate_employer" value={formData.pf_rate_employer || 0} onChange={handleChange} className="h-11 rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-muted-foreground">Employee Share (%)</Label>
                      <Input type="number" step="0.01" name="pf_rate_employee" value={formData.pf_rate_employee || 0} onChange={handleChange} className="h-11 rounded-lg" />
                    </div>
                  </div>
                </section>
                <section className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2"><ShieldCheck className="size-4" /> ESI Calculation</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-muted-foreground">Employer Share (%)</Label>
                      <Input type="number" step="0.01" name="esi_rate_employer" value={formData.esi_rate_employer || 0} onChange={handleChange} className="h-11 rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-muted-foreground">Employee Share (%)</Label>
                      <Input type="number" step="0.01" name="esi_rate_employee" value={formData.esi_rate_employee || 0} onChange={handleChange} className="h-11 rounded-lg" />
                    </div>
                  </div>
                </section>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="location" className="space-y-6">
          <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden">
            <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle>Manage Office Branches</CardTitle>
                <CardDescription>Add and manage multiple office locations for geofencing.</CardDescription>
              </div>
              <Button 
                variant="outline" 
                onClick={() => window.open('/kiosk', '_blank')}
                className="rounded-xl gap-2 h-10"
              >
                <QrCode className="size-4" /> Open Kiosk
              </Button>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              {/* Add New Location */}
              <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Add New Branch</h4>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="md:col-span-1">
                    <Label className="text-[10px] font-bold">Branch Name</Label>
                    <Input placeholder="e.g. Surat Branch" value={newLoc.name} onChange={(e) => setNewLoc({...newLoc, name: e.target.value})} className="h-10 rounded-lg mt-1" />
                  </div>
                  <div className="md:col-span-1">
                    <Label className="text-[10px] font-bold">Address</Label>
                    <Input placeholder="e.g. Ring Rd, Surat" value={newLoc.address} onChange={(e) => setNewLoc({...newLoc, address: e.target.value})} className="h-10 rounded-lg mt-1" />
                  </div>
                  <div className="md:col-span-1">
                    <Label className="text-[10px] font-bold">Latitude / Longitude</Label>
                    <div className="flex gap-2 mt-1">
                      <Input placeholder="Lat" type="number" value={newLoc.lat} onChange={(e) => setNewLoc({...newLoc, lat: e.target.value})} className="h-10 rounded-lg" />
                      <Input placeholder="Lng" type="number" value={newLoc.lng} onChange={(e) => setNewLoc({...newLoc, lng: e.target.value})} className="h-10 rounded-lg" />
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAddLocation} className="w-full h-10 rounded-xl gap-2 font-bold">
                      <Plus className="size-4" /> Add Branch
                    </Button>
                  </div>
                </div>
              </div>

              {/* Locations List */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Existing Locations</h4>
                <div className="grid gap-4">
                  {locations.map((loc: any) => (
                    <div key={loc.id} className="flex items-center justify-between p-4 rounded-xl border bg-muted/20 group hover:border-primary/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="size-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-primary border">
                          <MapPin className="size-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm tracking-tight">{loc.name}</p>
                          <p className="text-[10px] text-muted-foreground font-medium">{loc.address || "No address provided"}</p>
                          <p className="text-[8px] font-mono text-primary/50 mt-0.5">{loc.lat}, {loc.lng}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteLocation(loc.id)} className="text-muted-foreground hover:text-rose-500 rounded-lg">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {locations.length === 0 && (
                    <div className="text-center py-10 border-2 border-dashed rounded-2xl text-muted-foreground italic">No branches configured.</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

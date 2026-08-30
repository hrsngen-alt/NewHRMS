import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MapPin, Loader2, Navigation, CheckCircle, Clock, ArrowLeft } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export const Route = createFileRoute('/doctor-visits')({
  component: DoctorVisitsPage,
});

function DoctorVisitsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Form State
  const [doctorName, setDoctorName] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [visitPurpose, setVisitPurpose] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch Employee ID
  const { data: employee } = useQuery({
    queryKey: ['employee-profile', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, department, designation')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch Visits
  const { data: visits, isLoading } = useQuery({
    queryKey: ['my-doctor-visits', employee?.id],
    enabled: !!employee?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctor_visits')
        .select('*')
        .eq('employee_id', employee!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const getCoordinates = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
      } else {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      }
    });
  };

  const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`);
      if (!response.ok) throw new Error('Failed to reverse geocode');
      const data = await response.json();
      return data.display_name || 'Address not found';
    } catch (error) {
      console.error('Geocoding error:', error);
      return 'Address not found (Offline or service unavailable)';
    }
  };

  const checkInMutation = useMutation({
    mutationFn: async (visitData: any) => {
      const { error } = await supabase.from('doctor_visits').insert([visitData]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Doctor visit checked in successfully.');
      setIsDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['my-doctor-visits'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to check in');
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async ({ id, checkoutData }: { id: string; checkoutData: any }) => {
      const { error } = await supabase
        .from('doctor_visits')
        .update(checkoutData)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Doctor visit checked out successfully.');
      queryClient.invalidateQueries({ queryKey: ['my-doctor-visits'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to check out');
    },
  });

  const resetForm = () => {
    setDoctorName('');
    setHospitalName('');
    setContactNumber('');
    setVisitPurpose('');
    setNotes('');
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return toast.error('Employee record not found');
    if (!doctorName || !hospitalName || !visitPurpose) return toast.error('Please fill required fields');

    setIsLocating(true);
    try {
      const position = await getCoordinates();
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const accuracy = position.coords.accuracy;
      
      toast('Location captured successfully', { description: `Accuracy: ${accuracy.toFixed(0)}m` });
      
      const address = await reverseGeocode(lat, lon);

      await checkInMutation.mutateAsync({
        employee_id: employee.id,
        doctor_name: doctorName,
        hospital_name: hospitalName,
        contact_number: contactNumber,
        visit_purpose: visitPurpose,
        notes: notes,
        check_in_latitude: lat,
        check_in_longitude: lon,
        check_in_accuracy: accuracy,
        check_in_address: address,
        check_in_time: new Date().toISOString(),
        status: 'Checked In',
      });
    } catch (error: any) {
      if (error.code === 1) toast.error("Location permission was denied. Please enable location permission and try again.");
      else if (error.code === 2) toast.error("Unable to determine your current location. Please check your GPS/location settings.");
      else if (error.code === 3) toast.error("Location request timed out. Please try again.");
      else toast.error(error.message || 'Failed to capture location');
    } finally {
      setIsLocating(false);
    }
  };

  const handleCheckOut = async (visit: any) => {
    setIsLocating(true);
    try {
      const position = await getCoordinates();
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const accuracy = position.coords.accuracy;
      const address = await reverseGeocode(lat, lon);
      
      const checkInTime = new Date(visit.check_in_time);
      const checkOutTime = new Date();
      const duration = differenceInMinutes(checkOutTime, checkInTime);

      await checkOutMutation.mutateAsync({
        id: visit.id,
        checkoutData: {
          check_out_latitude: lat,
          check_out_longitude: lon,
          check_out_accuracy: accuracy,
          check_out_address: address,
          check_out_time: checkOutTime.toISOString(),
          visit_duration: Math.max(0, duration),
          status: 'Completed',
        }
      });
    } catch (error: any) {
      if (error.code === 1) toast.error("Location permission was denied. Please enable location permission and try again.");
      else if (error.code === 2) toast.error("Unable to determine your current location. Please check your GPS/location settings.");
      else if (error.code === 3) toast.error("Location request timed out. Please try again.");
      else toast.error(error.message || 'Failed to capture location');
    } finally {
      setIsLocating(false);
    }
  };

  const activeVisits = visits?.filter((v: any) => v.status === 'Checked In') || [];
  const completedVisits = visits?.filter((v: any) => v.status === 'Completed' || v.status === 'Cancelled') || [];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <Button variant="ghost" className="gap-2 -ml-3 text-muted-foreground hover:text-foreground" onClick={() => window.history.back()}>
        <ArrowLeft className="size-4" /> Back
      </Button>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">Doctor Visits</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Track and manage your field visits</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto font-bold shadow-lg shadow-primary/20 gap-2">
              <MapPin className="size-4" />
              New Visit Check-In
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Doctor Visit</DialogTitle>
              <DialogDescription>Fill details and capture current GPS location to check in.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCheckIn} className="space-y-4 py-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border text-sm mb-4">
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Employee:</span>
                  <span className="font-semibold">{employee?.full_name || 'Loading...'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dept:</span>
                  <span className="font-semibold">{employee?.department || 'N/A'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="doctorName">Doctor Name <span className="text-red-500">*</span></Label>
                <Input id="doctorName" placeholder="e.g. Dr. Rajesh Patel" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} required />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="hospitalName">Hospital / Clinic Name <span className="text-red-500">*</span></Label>
                <Input id="hospitalName" placeholder="e.g. Apollo Hospital" value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactNumber">Contact Number (Optional)</Label>
                <Input id="contactNumber" type="tel" placeholder="Phone number" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="visitPurpose">Visit Purpose <span className="text-red-500">*</span></Label>
                <Select value={visitPurpose} onValueChange={setVisitPurpose} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Doctor Meeting">Doctor Meeting</SelectItem>
                    <SelectItem value="Product Discussion">Product Discussion</SelectItem>
                    <SelectItem value="Follow-up">Follow-up</SelectItem>
                    <SelectItem value="Sales Visit">Sales Visit</SelectItem>
                    <SelectItem value="Business Meeting">Business Meeting</SelectItem>
                    <SelectItem value="New Doctor Introduction">New Doctor Introduction</SelectItem>
                    <SelectItem value="Hospital Visit">Hospital Visit</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Visit Notes (Optional)</Label>
                <Textarea id="notes" placeholder="Any discussion notes..." value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[80px]" />
              </div>
              
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLocating}>Cancel</Button>
                <Button type="submit" disabled={isLocating} className="gap-2 w-full sm:w-auto">
                  {isLocating ? <Loader2 className="size-4 animate-spin" /> : <Navigation className="size-4" />}
                  {isLocating ? 'Capturing Location...' : '📍 Check In & Capture Location'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {activeVisits.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Active Visits</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeVisits.map((visit: any) => (
              <Card key={visit.id} className="border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/10 dark:border-emerald-900/50">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base text-emerald-700 dark:text-emerald-400">{visit.doctor_name}</CardTitle>
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                      Checked In
                    </Badge>
                  </div>
                  <CardDescription>{visit.hospital_name}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-2 pb-2">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Clock className="size-3.5" />
                    <span>In: {format(new Date(visit.check_in_time), 'hh:mm a')}</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                    <MapPin className="size-3.5 mt-0.5 shrink-0" />
                    <span className="line-clamp-2 leading-tight">{visit.check_in_address}</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant="default" 
                    className="w-full gap-2 font-bold" 
                    onClick={() => handleCheckOut(visit)}
                    disabled={isLocating}
                  >
                    {isLocating ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
                    📍 Check Out & Capture Location
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Visit History</h2>
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="size-8 animate-spin text-primary" /></div>
        ) : completedVisits.length === 0 ? (
          <div className="text-center p-8 border rounded-xl border-dashed bg-slate-50 dark:bg-slate-900 text-muted-foreground">
            No past visits found.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedVisits.map((visit: any) => (
              <Card key={visit.id} className="shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base truncate" title={visit.doctor_name}>{visit.doctor_name}</CardTitle>
                      <CardDescription className="truncate" title={visit.hospital_name}>{visit.hospital_name}</CardDescription>
                    </div>
                    <Badge variant="outline" className={visit.status === 'Completed' ? 'bg-slate-100 dark:bg-slate-800' : ''}>
                      {visit.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-3">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="font-medium text-slate-900 dark:text-slate-200">{format(new Date(visit.visit_date), 'dd MMM yyyy')}</span>
                    {visit.visit_duration != null && (
                      <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-medium">{visit.visit_duration} mins</span>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="w-10 text-xs text-muted-foreground font-semibold">IN</div>
                      <div className="flex-1 text-xs">
                        <div className="font-medium text-slate-700 dark:text-slate-300">
                          {visit.check_in_time ? format(new Date(visit.check_in_time), 'hh:mm a') : 'N/A'}
                        </div>
                        <div className="text-muted-foreground line-clamp-1" title={visit.check_in_address}>{visit.check_in_address}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-10 text-xs text-muted-foreground font-semibold">OUT</div>
                      <div className="flex-1 text-xs">
                        <div className="font-medium text-slate-700 dark:text-slate-300">
                          {visit.check_out_time ? format(new Date(visit.check_out_time), 'hh:mm a') : 'N/A'}
                        </div>
                        <div className="text-muted-foreground line-clamp-1" title={visit.check_out_address}>{visit.check_out_address}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Ensure you export the Route as default if needed, or stick to this standard structure depending on setup
// Since we used `createFileRoute`, tanstack router expects the component property in the options.
// Also adding a tiny Badge component here just for completeness if it wasn't auto-imported
function Badge({ children, variant, className }: any) {
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${className}`}>{children}</span>;
}

import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/AppShell';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Download, FileDown, Search, Map, MapPin, ArrowLeft, Navigation } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import * as XLSX from 'xlsx';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet default icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function formatDuration(minutes: number) {
  if (!minutes) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
  }
  return `${mins} min`;
}

export const Route = createFileRoute('/reports-doctor-visits')({
  component: () => (
    <AppShell>
      <DoctorVisitsReportPage />
    </AppShell>
  ),
});

function DoctorVisitsReportPage() {
  const { role, user } = useAuth();
  const isAdminOrHR = role === 'admin' || role === 'manager'; // Treating manager as HR in this context

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [department, setDepartment] = useState('All');
  const [employeeId, setEmployeeId] = useState('All');
  const [status, setStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [selectedVisitForMap, setSelectedVisitForMap] = useState<any>(null);

  // Fetch all doctor visits with employee info
  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['admin-doctor-visits'],
    enabled: isAdminOrHR,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('doctor_visits')
        .select(`
          *,
          employees (id, full_name, department, designation, reporting_manager)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Filter Data
  const filteredData = useMemo(() => {
    return visits.filter((v: any) => {
      // Date filter
      if (dateFrom && v.visit_date < dateFrom) return false;
      if (dateTo && v.visit_date > dateTo) return false;
      
      // Dept filter
      if (department !== 'All' && v.employees?.department !== department) return false;
      
      // Employee filter
      if (employeeId !== 'All' && v.employees?.id !== employeeId) return false;
      
      // Status filter
      if (status !== 'All' && v.status !== status) return false;
      
      // Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const empName = v.employees?.full_name?.toLowerCase() || '';
        const docName = v.doctor_name?.toLowerCase() || '';
        const hospName = v.hospital_name?.toLowerCase() || '';
        if (!empName.includes(term) && !docName.includes(term) && !hospName.includes(term)) {
          return false;
        }
      }
      
      return true;
    });
  }, [visits, dateFrom, dateTo, department, employeeId, status, searchTerm]);

  // Extract unique employees for the dropdown
  const uniqueEmployees = useMemo(() => {
    const emps: Record<string, string> = {};
    visits.forEach((v: any) => {
      // Only show employees in Marketing department (or you can adjust this if they meant something else, but "all marketing employee list show that box" implies filtering to Marketing, or maybe just all employees if the dept filter is already there)
      if (v.employees?.id) {
        emps[v.employees.id] = v.employees.full_name;
      }
    });
    return Object.entries(emps)
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [visits]);

  // Grouped by Employee for Accordion View
  const groupedByEmployee = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredData.forEach((v: any) => {
      const empId = v.employees?.id || 'unknown';
      if (!groups[empId]) groups[empId] = [];
      groups[empId].push(v);
    });
    return Object.values(groups).sort((a, b) => {
      const nameA = a[0]?.employees?.full_name || '';
      const nameB = b[0]?.employees?.full_name || '';
      return nameA.localeCompare(nameB);
    });
  }, [filteredData]);

  // Summaries
  const totalVisits = filteredData.length;
  const marketingVisits = filteredData.filter((v: any) => v.employees?.department === 'Marketing').length;
  const completedVisits = filteredData.filter((v: any) => v.status === 'Completed').length;
  const checkedInVisits = filteredData.filter((v: any) => v.status === 'Checked In').length;
  const uniqueDoctors = new Set(filteredData.map((v: any) => v.doctor_name)).size;
  const uniqueEmployeesCount = new Set(filteredData.map((v: any) => v.employee_id)).size;

  const logExport = async (format: string, recordCount: number) => {
    try {
      await (supabase as any).from('audit_logs').insert({
        user_id: user?.id,
        action: 'EXPORT',
        entity: 'Doctor Visit Report',
        details: {
          format,
          recordCount,
          filters: { dateFrom, dateTo, department, status, searchTerm }
        }
      });
    } catch (e) {
      console.error("Failed to log export", e);
    }
  };

  const handleExportExcel = () => {
    if (!filteredData.length) return;
    const exportData = filteredData.map((v: any) => ({
      'Employee ID': v.employees?.id,
      'Employee Name': v.employees?.full_name,
      'Department': v.employees?.department,
      'Designation': v.employees?.designation,
      'Doctor Name': v.doctor_name,
      'Hospital/Clinic': v.hospital_name,
      'Contact Number': v.contact_number,
      'Visit Purpose': v.visit_purpose,
      'Visit Date': v.visit_date,
      'Check-In Time': v.check_in_time ? format(new Date(v.check_in_time), 'dd-MMM-yyyy hh:mm a') : '',
      'Check-In Latitude': v.check_in_latitude,
      'Check-In Longitude': v.check_in_longitude,
      'Check-In Address': v.check_in_address,
      'Check-Out Time': v.check_out_time ? format(new Date(v.check_out_time), 'dd-MMM-yyyy hh:mm a') : '',
      'Check-Out Latitude': v.check_out_latitude,
      'Check-Out Longitude': v.check_out_longitude,
      'Check-Out Address': v.check_out_address,
      'Visit Duration (Mins)': v.visit_duration,
      'Status': v.status,
      'Created At': v.created_at ? format(new Date(v.created_at), 'dd-MMM-yyyy hh:mm a') : '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DoctorVisits');
    XLSX.writeFile(workbook, `Doctor_Visit_Report_${format(new Date(), 'dd-MMM-yyyy')}.xlsx`);
    logExport('Excel', exportData.length);
  };

  const handleExportCSV = () => {
    if (!filteredData.length) return;
    const worksheet = XLSX.utils.json_to_sheet(filteredData.map((v: any) => ({
      EmployeeName: v.employees?.full_name,
      DoctorName: v.doctor_name,
      Hospital: v.hospital_name,
      Date: v.visit_date,
      Status: v.status
    })));
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Doctor_Visit_Report_${format(new Date(), 'dd-MMM-yyyy')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    logExport('CSV', filteredData.length);
  };

  if (!isAdminOrHR) {
    return <div className="p-8 text-center text-red-500">Access Denied</div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <Button variant="ghost" className="gap-2 -ml-3 text-muted-foreground hover:text-foreground" onClick={() => window.history.back()}>
        <ArrowLeft className="size-4" /> Back to Reports
      </Button>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">Doctor Visit Report</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Monitor field visits and export data</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-2" onClick={() => setShowMap(!showMap)}>
            <Map className="size-4" /> {showMap ? 'Hide Map' : 'View Map'}
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
            <Download className="size-4" /> CSV
          </Button>
          <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleExportExcel}>
            <FileDown className="size-4" /> Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold">Search (Emp/Doc/Hosp)</label>
            <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold">Department</label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Departments</SelectItem>
                <SelectItem value="Marketing">Marketing</SelectItem>
                <SelectItem value="Sales">Sales</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold">Employee</label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Employees</SelectItem>
                {uniqueEmployees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Statuses</SelectItem>
                <SelectItem value="Checked In">Checked In</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold">From Date</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold">To Date</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <SummaryCard title="Total Visits" value={totalVisits} />
        <SummaryCard title="Marketing" value={marketingVisits} />
        <SummaryCard title="Completed" value={completedVisits} />
        <SummaryCard title="Checked In" value={checkedInVisits} />
        <SummaryCard title="Doctors" value={uniqueDoctors} />
        <SummaryCard title="Employees" value={uniqueEmployeesCount} />
      </div>

      {/* Map View */}
      {showMap && (
        <Card className="shadow-sm overflow-hidden border-2 border-indigo-100 dark:border-indigo-900/30">
          <CardHeader className="bg-slate-50 dark:bg-slate-900 py-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <MapPin className="size-4 text-indigo-500" /> Filtered Visit Locations
            </CardTitle>
          </CardHeader>
          <div className="h-[400px] w-full z-0 relative">
            {typeof window !== 'undefined' && (
              <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                {filteredData.map((v: any) => {
                  if (v.check_in_latitude && v.check_in_longitude) {
                    return (
                      <Marker key={v.id} position={[v.check_in_latitude, v.check_in_longitude]}>
                        <Popup>
                          <div className="text-xs">
                            <p className="font-bold">{v.employees?.full_name}</p>
                            <p>{v.doctor_name} @ {v.hospital_name}</p>
                            <p className="text-muted-foreground mt-1">Status: {v.status}</p>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  }
                  return null;
                })}
              </MapContainer>
            )}
          </div>
        </Card>
      )}

      {/* Table / Accordion View */}
      <Card className="shadow-sm overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Employee-wise Visits</h2>
        </div>
        <div className="p-2 md:p-4 max-h-[600px] overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : groupedByEmployee.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No records found for current filters.</div>
          ) : (
            <Accordion type="multiple" className="w-full space-y-4">
              {groupedByEmployee.map((empVisits: any[]) => {
                const emp = empVisits[0]?.employees;
                const empName = emp?.full_name || 'Unknown Employee';
                const empId = emp?.id || 'unknown';
                return (
                  <AccordionItem key={empId} value={empId} className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
                    <AccordionTrigger className="px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-all hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex flex-col items-start text-left">
                          <span className="font-bold text-base text-slate-900 dark:text-white">{empName}</span>
                          <span className="text-xs text-muted-foreground">{emp?.department || 'No Dept'}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full">
                            {empVisits.length} Visits
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0 border-t border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-slate-50 dark:bg-slate-900">
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Doctor</TableHead>
                              <TableHead>Hospital/Clinic</TableHead>
                              <TableHead>Check In</TableHead>
                              <TableHead>Check Out</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Duration</TableHead>
                              <TableHead className="text-right">Location</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {empVisits.map((v: any) => (
                              <TableRow key={v.id}>
                                <TableCell className="whitespace-nowrap font-medium">{format(new Date(v.visit_date), 'dd MMM yyyy')}</TableCell>
                                <TableCell className="font-medium text-slate-700 dark:text-slate-300">{v.doctor_name}</TableCell>
                                <TableCell>{v.hospital_name}</TableCell>
                                <TableCell className="whitespace-nowrap">{v.check_in_time ? format(new Date(v.check_in_time), 'hh:mm a') : '-'}</TableCell>
                                <TableCell className="whitespace-nowrap">{v.check_out_time ? format(new Date(v.check_out_time), 'hh:mm a') : '-'}</TableCell>
                                <TableCell>
                                  <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-black ${v.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'}`}>
                                    {v.status}
                                  </span>
                                </TableCell>
                                <TableCell>{formatDuration(v.visit_duration)}</TableCell>
                                <TableCell className="text-right">
                                  <Button size="sm" variant="ghost" className="gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 h-8" onClick={() => setSelectedVisitForMap(v)}>
                                    <MapPin className="size-3.5" /> Map
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      </Card>

      {/* Individual Map Dialog */}
      <Dialog open={!!selectedVisitForMap} onOpenChange={(open) => !open && setSelectedVisitForMap(null)}>
        <DialogContent className="max-w-3xl rounded-[2rem] p-0 overflow-hidden">
          <div className="p-6 pb-4">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black flex items-center gap-2">
                <Navigation className="size-6 text-indigo-500" /> Visit Location Details
              </DialogTitle>
            </DialogHeader>
            <div className="flex gap-4 mt-2 text-sm">
              <div className="text-slate-600 dark:text-slate-400">
                <span className="font-bold text-slate-900 dark:text-white">Employee:</span> {selectedVisitForMap?.employees?.full_name}
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                <span className="font-bold text-slate-900 dark:text-white">Doctor:</span> {selectedVisitForMap?.doctor_name}
              </div>
            </div>
          </div>
          <div className="h-[400px] w-full bg-slate-100 z-0 relative">
            {typeof window !== 'undefined' && selectedVisitForMap && (
              <MapContainer 
                center={
                  selectedVisitForMap.check_in_latitude && selectedVisitForMap.check_in_longitude 
                    ? [selectedVisitForMap.check_in_latitude, selectedVisitForMap.check_in_longitude] 
                    : [20.5937, 78.9629]
                } 
                zoom={14} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                
                {/* Check In Marker */}
                {selectedVisitForMap.check_in_latitude && selectedVisitForMap.check_in_longitude && (
                  <Marker position={[selectedVisitForMap.check_in_latitude, selectedVisitForMap.check_in_longitude]}>
                    <Popup>
                      <div className="text-xs">
                        <p className="font-black text-indigo-600 uppercase tracking-widest mb-1">Check In</p>
                        <p className="text-muted-foreground">{selectedVisitForMap.check_in_time ? format(new Date(selectedVisitForMap.check_in_time), 'hh:mm a') : ''}</p>
                        <p className="mt-1">{selectedVisitForMap.check_in_address}</p>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Check Out Marker */}
                {selectedVisitForMap.check_out_latitude && selectedVisitForMap.check_out_longitude && (
                  <Marker position={[selectedVisitForMap.check_out_latitude, selectedVisitForMap.check_out_longitude]}>
                    <Popup>
                      <div className="text-xs">
                        <p className="font-black text-rose-600 uppercase tracking-widest mb-1">Check Out</p>
                        <p className="text-muted-foreground">{selectedVisitForMap.check_out_time ? format(new Date(selectedVisitForMap.check_out_time), 'hh:mm a') : ''}</p>
                        <p className="mt-1">{selectedVisitForMap.check_out_address}</p>
                      </div>
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{title}</div>
      <div className="text-2xl font-black">{value}</div>
    </div>
  );
}

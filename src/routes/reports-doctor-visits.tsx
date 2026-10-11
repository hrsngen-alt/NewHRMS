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
import { Download, FileDown, Search, Map, MapPin, ArrowLeft, Navigation, Calendar, FileSpreadsheet } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
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

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

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

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState<'day' | 'month'>('day');
  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [isMonthDownloadOpen, setIsMonthDownloadOpen] = useState(false);

  // States for dedicated Month-Wise Download Dialog
  const [modalMonth, setModalMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [modalYear, setModalYear] = useState<string>(String(new Date().getFullYear()));
  const [modalDepartment, setModalDepartment] = useState<string>('All');
  const [modalEmployeeId, setModalEmployeeId] = useState<string>('All');
  const [modalStatus, setModalStatus] = useState<string>('All');

  const [department, setDepartment] = useState('All');
  const [employeeId, setEmployeeId] = useState('All');
  const [status, setStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [selectedVisitForMap, setSelectedVisitForMap] = useState<any>(null);

  const availableYears = useMemo(() => {
    const curYear = new Date().getFullYear();
    return [String(curYear - 2), String(curYear - 1), String(curYear), String(curYear + 1)];
  }, []);

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

  // Filter Data for current page view
  const filteredData = useMemo(() => {
    return visits.filter((v: any) => {
      // Date or Month filter
      if (viewMode === 'day') {
        if (selectedDate && v.visit_date !== selectedDate) return false;
      } else {
        const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
        if (!v.visit_date || !v.visit_date.startsWith(monthPrefix)) return false;
      }
      
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
  }, [visits, viewMode, selectedDate, selectedMonth, selectedYear, department, employeeId, status, searchTerm]);

  // Filtered visits specifically for the Month-Wise Download Dialog
  const modalFilteredVisits = useMemo(() => {
    const monthPrefix = `${modalYear}-${String(modalMonth).padStart(2, '0')}`;
    return visits.filter((v: any) => {
      if (!v.visit_date || !v.visit_date.startsWith(monthPrefix)) return false;
      if (modalDepartment !== 'All' && v.employees?.department !== modalDepartment) return false;
      if (modalEmployeeId !== 'All' && v.employees?.id !== modalEmployeeId) return false;
      if (modalStatus !== 'All' && v.status !== modalStatus) return false;
      return true;
    });
  }, [visits, modalMonth, modalYear, modalDepartment, modalEmployeeId, modalStatus]);

  // Extract unique employees for the dropdown
  const uniqueEmployees = useMemo(() => {
    const emps: Record<string, string> = {};
    visits.forEach((v: any) => {
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

  const logExport = async (formatType: string, recordCount: number, customFilters?: any) => {
    try {
      await (supabase as any).from('audit_logs').insert({
        user_id: user?.id,
        action: 'EXPORT',
        entity: 'Doctor Visit Report',
        details: {
          format: formatType,
          recordCount,
          filters: customFilters || { viewMode, selectedDate, selectedMonth, selectedYear, department, status, searchTerm }
        }
      });
    } catch (e) {
      console.error("Failed to log export", e);
    }
  };

  const mapVisitsToEmployeeSummaryRows = (list: any[]) => {
    const groups: Record<string, any[]> = {};
    list.forEach((v: any) => {
      const empId = v.employees?.id || v.employee_id || v.employees?.full_name || 'unknown';
      if (!groups[empId]) groups[empId] = [];
      groups[empId].push(v);
    });

    const summaryList = Object.values(groups).map((empVisits) => {
      const emp = empVisits[0]?.employees;
      const totalVisitsCount = empVisits.length;
      const completed = empVisits.filter((v: any) => v.status === 'Completed').length;
      const checkedIn = empVisits.filter((v: any) => v.status === 'Checked In').length;
      const cancelled = empVisits.filter((v: any) => v.status === 'Cancelled').length;
      const uniqueDocs = new Set(empVisits.map((v: any) => v.doctor_name).filter(Boolean)).size;
      const uniqueHosps = new Set(empVisits.map((v: any) => v.hospital_name).filter(Boolean)).size;
      const totalMinutes = empVisits.reduce((acc: number, v: any) => acc + (Number(v.visit_duration) || 0), 0);
      const activeDays = new Set(empVisits.map((v: any) => v.visit_date).filter(Boolean)).size;

      return {
        'Employee ID': emp?.id || '',
        'Employee Name': emp?.full_name || 'Unknown Employee',
        'Department': emp?.department || '—',
        'Designation': emp?.designation || '—',
        'Total Visits': totalVisitsCount,
        'Completed Visits': completed,
        'Checked-In Visits': checkedIn,
        'Cancelled Visits': cancelled,
        'Unique Doctors Met': uniqueDocs,
        'Unique Hospitals Visited': uniqueHosps,
        'Total Field Time': formatDuration(totalMinutes),
        'Total Duration (Mins)': totalMinutes,
        'Active Field Days': activeDays,
      };
    });

    return summaryList.sort((a, b) => a['Employee Name'].localeCompare(b['Employee Name']));
  };

  const mapVisitsToDetailedRows = (list: any[]) => {
    // Sort by employee name, then date, then check-in time
    const sorted = [...list].sort((a, b) => {
      const nameA = a.employees?.full_name || '';
      const nameB = b.employees?.full_name || '';
      const cmp = nameA.localeCompare(nameB);
      if (cmp !== 0) return cmp;
      const dateA = a.visit_date || '';
      const dateB = b.visit_date || '';
      const dateCmp = dateA.localeCompare(dateB);
      if (dateCmp !== 0) return dateCmp;
      const timeA = a.check_in_time || '';
      const timeB = b.check_in_time || '';
      return timeA.localeCompare(timeB);
    });

    const empVisitCounters: Record<string, number> = {};

    return sorted.map((v: any) => {
      const empId = v.employees?.id || v.employee_id || v.employees?.full_name || 'unknown';
      empVisitCounters[empId] = (empVisitCounters[empId] || 0) + 1;
      const visitIndex = empVisitCounters[empId];

      return {
        'Visit #': visitIndex,
        'Employee ID': v.employees?.id || '',
        'Employee Name': v.employees?.full_name || '',
        'Department': v.employees?.department || '',
        'Designation': v.employees?.designation || '',
        'Doctor Name': v.doctor_name || '',
        'Hospital/Clinic': v.hospital_name || '',
        'Contact Number': v.contact_number || '',
        'Visit Purpose': v.visit_purpose || '',
        'Visit Date': v.visit_date || '',
        'Check-In Time': v.check_in_time ? format(new Date(v.check_in_time), 'dd-MMM-yyyy hh:mm a') : '',
        'Check-In Latitude': v.check_in_latitude ?? '',
        'Check-In Longitude': v.check_in_longitude ?? '',
        'Check-In Address': v.check_in_address || '',
        'Check-Out Time': v.check_out_time ? format(new Date(v.check_out_time), 'dd-MMM-yyyy hh:mm a') : '',
        'Check-Out Latitude': v.check_out_latitude ?? '',
        'Check-Out Longitude': v.check_out_longitude ?? '',
        'Check-Out Address': v.check_out_address || '',
        'Visit Duration (Mins)': v.visit_duration ?? '',
        'Status': v.status || '',
        'Created At': v.created_at ? format(new Date(v.created_at), 'dd-MMM-yyyy hh:mm a') : '',
      };
    });
  };

  const handleExportExcel = () => {
    if (!filteredData.length) {
      toast.info('No visit data available to export.');
      return;
    }
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Employee Summary
    const summaryData = mapVisitsToEmployeeSummaryRows(filteredData);
    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Employee Summary');

    // Sheet 2: Detailed Visits
    const exportData = mapVisitsToDetailedRows(filteredData);
    const detailedWorksheet = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(workbook, detailedWorksheet, 'Detailed Visits');
    
    const curMonthLabel = MONTHS.find(m => m.value === selectedMonth)?.label || 'Month';
    const fileSuffix = viewMode === 'month' 
      ? `${curMonthLabel}_${selectedYear}` 
      : selectedDate ? format(new Date(selectedDate), 'dd-MMM-yyyy') : format(new Date(), 'dd-MMM-yyyy');
    
    const fileName = `Doctor_Visit_Report_${fileSuffix}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    logExport('Excel', exportData.length);
    toast.success(`Exported ${fileName}`);
  };

  const handleExportCSV = () => {
    if (!filteredData.length) {
      toast.info('No visit data available to export.');
      return;
    }
    
    // In month mode provide full detailed columns, in daily maintain full or standard fields
    const exportRows = viewMode === 'month'
      ? mapVisitsToDetailedRows(filteredData)
      : filteredData.map((v: any) => ({
          EmployeeName: v.employees?.full_name || '',
          DoctorName: v.doctor_name || '',
          Hospital: v.hospital_name || '',
          Date: v.visit_date || '',
          Status: v.status || ''
        }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);

    const curMonthLabel = MONTHS.find(m => m.value === selectedMonth)?.label || 'Month';
    const fileSuffix = viewMode === 'month' 
      ? `${curMonthLabel}_${selectedYear}` 
      : selectedDate ? format(new Date(selectedDate), 'dd-MMM-yyyy') : format(new Date(), 'dd-MMM-yyyy');

    const fileName = `Doctor_Visit_Report_${fileSuffix}.csv`;
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    logExport('CSV', filteredData.length);
    toast.success(`Exported ${fileName}`);
  };

  // Dedicated handlers for Month-Wise Download Dialog
  const handleDownloadMonthExcel = () => {
    if (!modalFilteredVisits.length) {
      toast.error('No visits found for the selected month and filters.');
      return;
    }
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Employee Summary
    const summaryData = mapVisitsToEmployeeSummaryRows(modalFilteredVisits);
    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Employee Summary');

    // Sheet 2: Detailed Visits
    const exportData = mapVisitsToDetailedRows(modalFilteredVisits);
    const detailedWorksheet = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(workbook, detailedWorksheet, 'Detailed Visits');
    
    const mName = MONTHS.find(m => m.value === modalMonth)?.label || 'Month';
    const fileName = `Doctor_Visit_Report_${mName}_${modalYear}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    logExport('Excel (Month-Wise)', exportData.length, { month: modalMonth, year: modalYear, department: modalDepartment, employeeId: modalEmployeeId, status: modalStatus });
    toast.success(`Downloaded ${fileName} (${exportData.length} records)`);
  };

  const handleDownloadMonthCSV = () => {
    if (!modalFilteredVisits.length) {
      toast.error('No visits found for the selected month and filters.');
      return;
    }
    const exportData = mapVisitsToDetailedRows(modalFilteredVisits);
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    
    const mName = MONTHS.find(m => m.value === modalMonth)?.label || 'Month';
    const fileName = `Doctor_Visit_Report_${mName}_${modalYear}.csv`;
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    logExport('CSV (Month-Wise)', exportData.length, { month: modalMonth, year: modalYear, department: modalDepartment, employeeId: modalEmployeeId, status: modalStatus });
    toast.success(`Downloaded ${fileName} (${exportData.length} records)`);
  };

  if (!isAdminOrHR) {
    return <div className="p-8 text-center text-red-500">Access Denied</div>;
  }

  const isToday = selectedDate === todayStr;
  const displayDateStr = selectedDate ? format(new Date(selectedDate), 'd MMMM yyyy') : '';
  const currentMonthLabel = MONTHS.find(m => m.value === selectedMonth)?.label || 'Month';
  const reportTitle = viewMode === 'month'
    ? `📅 ${currentMonthLabel} ${selectedYear} — Monthly Report`
    : isToday 
      ? `📅 ${displayDateStr} — Today's Report` 
      : `📅 ${displayDateStr} — Report`;

  const modalMonthLabel = MONTHS.find(m => m.value === modalMonth)?.label || 'Month';

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <Button variant="ghost" className="gap-2 -ml-3 text-muted-foreground hover:text-foreground" onClick={() => window.history.back()}>
        <ArrowLeft className="size-4" /> Back to Reports
      </Button>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">{reportTitle}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {/* View Mode Toggle: Daily vs Monthly */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('day')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  viewMode === 'day'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Daily View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  viewMode === 'month'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Monthly View
              </button>
            </div>

            {viewMode === 'day' ? (
              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Select Date:</label>
                <Input 
                  type="date" 
                  value={selectedDate} 
                  max={todayStr}
                  onChange={(e) => setSelectedDate(e.target.value)} 
                  className="w-auto h-9"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Select Month:</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[95px] h-9">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((yr) => (
                      <SelectItem key={yr} value={yr}>{yr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Button variant="outline" className="gap-2" onClick={() => setShowMap(!showMap)}>
            <Map className="size-4" /> {showMap ? 'Hide Map' : 'View Map'}
          </Button>

          {/* Month-Wise Download Dialog */}
          <Dialog open={isMonthDownloadOpen} onOpenChange={setIsMonthDownloadOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40">
                <Calendar className="size-4 text-indigo-600 dark:text-indigo-400" /> Month-Wise Download
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-black flex items-center gap-2">
                  <FileSpreadsheet className="size-5 text-indigo-600 dark:text-indigo-400" />
                  Download Month-Wise Doctor Report
                </DialogTitle>
                <DialogDescription>
                  Select month and year to export all doctor visit logs in CSV or Excel format.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Month</label>
                    <Select value={modalMonth} onValueChange={setModalMonth}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Year</label>
                    <Select value={modalYear} onValueChange={setModalYear}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableYears.map((yr) => (
                          <SelectItem key={yr} value={yr}>{yr}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Department</label>
                    <Select value={modalDepartment} onValueChange={setModalDepartment}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Departments</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Status</label>
                    <Select value={modalStatus} onValueChange={setModalStatus}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Statuses</SelectItem>
                        <SelectItem value="Checked In">Checked In</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Employee Filter (Optional)</label>
                  <Select value={modalEmployeeId} onValueChange={setModalEmployeeId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Employees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Employees</SelectItem>
                      {uniqueEmployees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Record Count Preview Box */}
                <div className="p-3 bg-indigo-50/80 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Selected: <span className="font-bold text-indigo-600 dark:text-indigo-400">{modalMonthLabel} {modalYear}</span>
                  </div>
                  <span className="text-xs font-bold bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full shadow-2xs">
                    {modalFilteredVisits.length} visits found
                  </span>
                </div>

                {/* Download Actions */}
                <div className="flex gap-3 pt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1 gap-2 border-slate-300 dark:border-slate-700" 
                    onClick={handleDownloadMonthCSV}
                    disabled={modalFilteredVisits.length === 0}
                  >
                    <Download className="size-4 text-slate-600 dark:text-slate-300" /> Download CSV
                  </Button>
                  <Button 
                    type="button" 
                    className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" 
                    onClick={handleDownloadMonthExcel}
                    disabled={modalFilteredVisits.length === 0}
                  >
                    <FileDown className="size-4" /> Download Excel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

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
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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

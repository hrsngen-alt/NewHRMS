import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type Payslip = {
  id: string;
  working_days: number;
  paid_days: number;
  basic: number; hra: number; conveyance: number; medical: number;
  special_allowance: number; bonus: number;
  pf: number; esic: number; pt: number; tds: number; leave_deduction: number;
  gross: number; total_deductions: number; net_pay: number;
  payroll_runs?: { period_month: number; period_year: number };
  employees?: {
    full_name: string; employee_code: string; department?: string | null;
    designation?: string | null; pan_number?: string | null; uan_number?: string | null;
    bank_name?: string | null; bank_account?: string | null; bank_ifsc?: string | null;
  };
};

const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt = (n: number) => `INR ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function numToWords(num: number): string {
  const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n/10)] + (n%10 ? " " + a[n%10] : "");
    if (n < 1000) return a[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + inWords(n%100) : "");
    if (n < 100000) return inWords(Math.floor(n/1000)) + " Thousand" + (n%1000 ? " " + inWords(n%1000) : "");
    if (n < 10000000) return inWords(Math.floor(n/100000)) + " Lakh" + (n%100000 ? " " + inWords(n%100000) : "");
    return inWords(Math.floor(n/10000000)) + " Crore" + (n%10000000 ? " " + inWords(n%10000000) : "");
  };
  return inWords(Math.floor(num)) + " Rupees Only";
}

export function generatePayslipPDF(p: Payslip, companyName: string = "SN Gene HR") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const period = p.payroll_runs ? `${months[p.payroll_runs.period_month - 1]} ${p.payroll_runs.period_year}` : "";
  const emp = p.employees!;

  // Header band
  doc.setFillColor(82, 71, 200);
  doc.rect(0, 0, W, 70, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold").setFontSize(18).text(companyName, 40, 32);
  doc.setFont("helvetica", "normal").setFontSize(10).text("Payslip · Confidential", 40, 50);
  doc.setFont("helvetica", "bold").setFontSize(12).text(`Pay period: ${period}`, W - 40, 40, { align: "right" });

  // Employee info
  doc.setTextColor(30);
  doc.setFontSize(10);
  const left = [
    ["Employee", emp.full_name], ["Employee ID", emp.employee_code],
    ["Department", emp.department || "—"], ["Designation", emp.designation || "—"],
  ];
  const right = [
    ["PAN", emp.pan_number || "—"], ["UAN", emp.uan_number || "—"],
    ["Bank", emp.bank_name || "—"], ["A/C No.", emp.bank_account || "—"],
  ];
  let y = 100;
  left.forEach((row, i) => {
    doc.setFont("helvetica", "normal").setTextColor(120).text(row[0], 40, y + i * 16);
    doc.setFont("helvetica", "bold").setTextColor(30).text(row[1], 130, y + i * 16);
  });
  right.forEach((row, i) => {
    doc.setFont("helvetica", "normal").setTextColor(120).text(row[0], 320, y + i * 16);
    doc.setFont("helvetica", "bold").setTextColor(30).text(row[1], 400, y + i * 16);
  });

  // Working days
  y += left.length * 16 + 14;
  doc.setFillColor(245, 245, 252);
  doc.rect(40, y, W - 80, 28, "F");
  doc.setFont("helvetica", "normal").setTextColor(80).setFontSize(10);
  doc.text(`Working days: ${p.working_days}`, 50, y + 18);
  doc.text(`Paid days: ${p.paid_days}`, 200, y + 18);

  // Earnings & Deductions tables
  const earnings = [
    ["Basic", fmt(p.basic)], ["HRA", fmt(p.hra)],
    ["Conveyance", fmt(p.conveyance)], ["Medical", fmt(p.medical)],
    ["Special allowance", fmt(p.special_allowance)], ["Bonus", fmt(p.bonus)],
  ];
  const deductions = [
    ["PF", fmt(p.pf)], ["ESIC", fmt(p.esic)], ["Professional tax", fmt(p.pt)],
    ["TDS", fmt(p.tds)], ["Leave deduction", fmt(p.leave_deduction)],
  ];

  autoTable(doc, {
    head: [["Earnings", "Amount"]],
    body: earnings,
    foot: [["Gross earnings", fmt(p.gross)]],
    startY: y + 44, margin: { left: 40, right: W / 2 + 10 },
    theme: "grid", headStyles: { fillColor: [82, 71, 200], textColor: 255 },
    footStyles: { fillColor: [240, 238, 252], textColor: 30, fontStyle: "bold" },
    styles: { fontSize: 10 },
  });
  autoTable(doc, {
    head: [["Deductions", "Amount"]],
    body: deductions,
    foot: [["Total deductions", fmt(p.total_deductions)]],
    startY: y + 44, margin: { left: W / 2 + 10, right: 40 },
    theme: "grid", headStyles: { fillColor: [82, 71, 200], textColor: 255 },
    footStyles: { fillColor: [240, 238, 252], textColor: 30, fontStyle: "bold" },
    styles: { fontSize: 10 },
  });

  // Net pay strip
  // @ts-expect-error jsPDF lastAutoTable typing
  const finalY = (doc as any).lastAutoTable?.finalY || (doc as any).autoTable?.previous?.finalY || (y + 44 + earnings.length * 22);
  const yEnd = Math.max(finalY, y + 44 + earnings.length * 22) + 20;
  doc.setFillColor(34, 34, 60);
  doc.rect(40, yEnd, W - 80, 56, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "normal").setFontSize(11).text("Net pay", 56, yEnd + 22);
  doc.setFont("helvetica", "bold").setFontSize(20).text(fmt(p.net_pay), W - 56, yEnd + 30, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(220);
  doc.text(numToWords(p.net_pay), 56, yEnd + 46);

  // Footer
  doc.setFontSize(8).setTextColor(140);
  doc.text(`This is a system-generated payslip. Digitally verified by ${companyName}.`, W / 2, 800, { align: "center" });

  doc.save(`Payslip_${emp.employee_code}_${period.replace(" ", "_")}.pdf`);
}

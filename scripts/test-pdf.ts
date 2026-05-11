import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const doc = new jsPDF({ unit: "pt", format: "a4" });
console.log("Before autoTable doc.lastAutoTable:", (doc as any).lastAutoTable);

autoTable(doc, {
  head: [["Earnings", "Amount"]],
  body: [["Basic", "100"]],
});

console.log("After autoTable doc.lastAutoTable:", (doc as any).lastAutoTable);
console.log("doc.autoTable:", (doc as any).autoTable);

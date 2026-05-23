const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'lib', 'payslip.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add gratuity to type definition (replacing the single line to avoid newline issues)
const targetLine = '  pf: number; esic: number; pt: number; tds: number; leave_deduction: number;';
const replacementLine = '  pf: number; esic: number; pt: number; tds: number; leave_deduction: number; gratuity: number;';

if (content.includes(targetLine)) {
  content = content.replace(targetLine, replacementLine);
  console.log('Type definition updated.');
} else {
  console.log('Target line for type definition not found!');
}

// 2. Make sure the deductions table is fully updated
const targetDeductionsLine = '    ["PF", fmt(p.pf)], ["ESIC", fmt(p.esic)], ["Professional tax", fmt(p.pt)],';
const replacementDeductionsLine = '    ["PF", fmt(p.pf)], ["ESIC", fmt(p.esic)], ["Gratuity", fmt(p.gratuity || 0)], ["Professional tax", fmt(p.pt)],';

if (content.includes(targetDeductionsLine)) {
  content = content.replace(targetDeductionsLine, replacementDeductionsLine);
  console.log('Deductions table updated.');
} else {
  console.log('Deductions table line already updated or not found.');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done!');

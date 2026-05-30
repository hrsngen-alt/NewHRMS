import 'package:share_plus/share_plus.dart';
import 'package:intl/intl.dart';
import '../models/employee.dart';

class PayslipShareService {
  static Future<void> sharePayslip(Employee employee) async {
    final now = DateTime.now();
    final String monthName = DateFormat('MMMM yyyy').format(now).toUpperCase();

    final String formatter = '''
========================================
         SN GENE HRMS PAYSLIP           
========================================
PAYSLIP FOR:    $monthName
EMPLOYEE:       ${employee.fullName.toUpperCase()}
DESIGNATION:    ${employee.designation?.toUpperCase() ?? "STAFF"}
DEPARTMENT:     ${employee.department?.toUpperCase() ?? "STAFF"}
EMPLOYEE CODE:  ${employee.employeeCode}
========================================
EARNINGS (MONTHLY):
  Basic Salary:       ₹${employee.basicSalary.toStringAsFixed(0)}
  HRA Allowance:      ₹${employee.hra.toStringAsFixed(0)}
  Performance Bonus:  ₹${employee.bonus.toStringAsFixed(0)}
----------------------------------------
DEDUCTIONS:
  Provident Fund (PF): ₹${employee.pfAmount.toStringAsFixed(0)}
  ESIC Contribution:  ₹${employee.esicAmount.toStringAsFixed(0)}
========================================
TOTAL SUMMARY:
  GROSS PAY:          ₹${employee.grossSalary.toStringAsFixed(0)}
  TOTAL DEDUCTIONS:   ₹${employee.totalDeductions.toStringAsFixed(0)}
  
  NET TAKE-HOME:      ₹${employee.netPay.toStringAsFixed(0)}
========================================
Generated securely via SN Gene Mobile client.
========================================
''';

    await Share.share(
      formatter,
      subject: 'HRMS Payslip - $monthName',
    );
  }
}

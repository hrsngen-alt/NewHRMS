class Employee {
  final String id;
  final String fullName;
  final String email;
  final String? phone;
  final String? department;
  final String? designation;
  final String employeeCode;
  final double basicSalary;
  final double hra;
  final double bonus;
  final double pfAmount;
  final double esicAmount;
  final double gratuityAmount;
  final String status;
  final String? userId;

  Employee({
    required this.id,
    required this.fullName,
    required this.email,
    this.phone,
    this.department,
    this.designation,
    required this.employeeCode,
    required this.basicSalary,
    required this.hra,
    required this.bonus,
    required this.pfAmount,
    required this.esicAmount,
    required this.gratuityAmount,
    required this.status,
    this.userId,
  });

  factory Employee.fromJson(Map<String, dynamic> json) {
    return Employee(
      id: (json['id'] ?? '').toString(),
      fullName: (json['full_name'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      phone: json['phone']?.toString(),
      department: json['department']?.toString(),
      designation: json['designation']?.toString(),
      employeeCode: (json['employee_code'] ?? '').toString(),
      basicSalary: json['basic_salary'] != null 
          ? double.tryParse(json['basic_salary'].toString()) ?? 0.0 
          : 0.0,
      hra: json['hra'] != null 
          ? double.tryParse(json['hra'].toString()) ?? 0.0 
          : 0.0,
      bonus: json['bonus'] != null 
          ? double.tryParse(json['bonus'].toString()) ?? 0.0 
          : 0.0,
      pfAmount: json['pf_amount'] != null 
          ? double.tryParse(json['pf_amount'].toString()) ?? 0.0 
          : 0.0,
      esicAmount: json['esic_amount'] != null 
          ? double.tryParse(json['esic_amount'].toString()) ?? 0.0 
          : 0.0,
      gratuityAmount: json['gratuity_amount'] != null 
          ? double.tryParse(json['gratuity_amount'].toString()) ?? 0.0 
          : 0.0,
      status: (json['status'] ?? 'active').toString(),
      userId: json['user_id']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'full_name': fullName,
      'email': email,
      'phone': phone,
      'department': department,
      'designation': designation,
      'employee_code': employeeCode,
      'basic_salary': basicSalary,
      'hra': hra,
      'bonus': bonus,
      'pf_amount': pfAmount,
      'esic_amount': esicAmount,
      'gratuity_amount': gratuityAmount,
      'status': status,
      'user_id': userId,
    };
  }

  double get grossSalary => basicSalary + hra + bonus;
  double get totalDeductions => pfAmount + esicAmount + (grossSalary > 15000 ? 200 : 0);
  double get netPay => grossSalary - totalDeductions;
  double get ctc => grossSalary + (basicSalary <= 21000 ? basicSalary * 0.0325 : 0) + (basicSalary * 0.0481);
}

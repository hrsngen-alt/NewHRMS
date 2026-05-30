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
      id: json['id'] as String,
      fullName: (json['full_name'] ?? '') as String,
      email: (json['email'] ?? '') as String,
      phone: json['phone'] as String?,
      department: json['department'] as String?,
      designation: json['designation'] as String?,
      employeeCode: (json['employee_code'] ?? '') as String,
      basicSalary: (json['basic_salary'] ?? 0.0) is int 
          ? (json['basic_salary'] as int).toDouble() 
          : (json['basic_salary'] as num).toDouble(),
      hra: (json['hra'] ?? 0.0) is int 
          ? (json['hra'] as int).toDouble() 
          : (json['hra'] as num).toDouble(),
      bonus: (json['bonus'] ?? 0.0) is int 
          ? (json['bonus'] as int).toDouble() 
          : (json['bonus'] as num).toDouble(),
      pfAmount: (json['pf_amount'] ?? 0.0) is int 
          ? (json['pf_amount'] as int).toDouble() 
          : (json['pf_amount'] as num).toDouble(),
      esicAmount: (json['esic_amount'] ?? 0.0) is int 
          ? (json['esic_amount'] as int).toDouble() 
          : (json['esic_amount'] as num).toDouble(),
      gratuityAmount: (json['gratuity_amount'] ?? 0.0) is int 
          ? (json['gratuity_amount'] as int).toDouble() 
          : (json['gratuity_amount'] as num).toDouble(),
      status: (json['status'] ?? 'active') as String,
      userId: json['user_id'] as String?,
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

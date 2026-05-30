import 'employee.dart';

class Attendance {
  final String id;
  final String employeeId;
  final String date;
  final DateTime checkIn;
  final DateTime? checkOut;
  final double? hoursWorked;
  final String status;
  final double? checkInLat;
  final double? checkInLng;
  final double? checkOutLat;
  final double? checkOutLng;
  final Map<String, dynamic>? metadata;
  final Employee? employee;

  Attendance({
    required this.id,
    required this.employeeId,
    required this.date,
    required this.checkIn,
    this.checkOut,
    this.hoursWorked,
    required this.status,
    this.checkInLat,
    this.checkInLng,
    this.checkOutLat,
    this.checkOutLng,
    this.metadata,
    this.employee,
  });

  factory Attendance.fromJson(Map<String, dynamic> json) {
    // Check if there is an employee relation nested
    Employee? employeeRelation;
    if (json['employees'] != null) {
      employeeRelation = Employee.fromJson(json['employees'] as Map<String, dynamic>);
    }

    return Attendance(
      id: json['id'] as String,
      employeeId: (json['employee_id'] ?? '') as String,
      date: (json['date'] ?? '') as String,
      checkIn: DateTime.parse(json['check_in'] as String),
      checkOut: json['check_out'] != null 
          ? DateTime.parse(json['check_out'] as String) 
          : null,
      hoursWorked: json['hours_worked'] != null 
          ? (json['hours_worked'] as num).toDouble() 
          : null,
      status: (json['status'] ?? 'present') as String,
      checkInLat: json['check_in_lat'] != null 
          ? (json['check_in_lat'] as num).toDouble() 
          : null,
      checkInLng: json['check_in_lng'] != null 
          ? (json['check_in_lng'] as num).toDouble() 
          : null,
      checkOutLat: json['check_out_lat'] != null 
          ? (json['check_out_lat'] as num).toDouble() 
          : null,
      checkOutLng: json['check_out_lng'] != null 
          ? (json['check_out_lng'] as num).toDouble() 
          : null,
      metadata: json['metadata'] as Map<String, dynamic>?,
      employee: employeeRelation,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'employee_id': employeeId,
      'date': date,
      'check_in': checkIn.toIso8601String(),
      'check_out': checkOut?.toIso8601String(),
      'hours_worked': hoursWorked,
      'status': status,
      'check_in_lat': checkInLat,
      'check_in_lng': checkInLng,
      'check_out_lat': checkOutLat,
      'check_out_lng': checkOutLng,
      'metadata': metadata,
    };
  }

  bool get isActive => checkOut == null;
}

import 'dart:convert';
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
      try {
        if (json['employees'] is Map) {
          employeeRelation = Employee.fromJson(Map<String, dynamic>.from(json['employees'] as Map));
        }
      } catch (e) {
        print("❌ Error parsing employeeRelation in Attendance.fromJson: $e");
      }
    }

    Map<String, dynamic>? metadataMap;
    if (json['metadata'] != null) {
      if (json['metadata'] is String) {
        try {
          metadataMap = jsonDecode(json['metadata'] as String) as Map<String, dynamic>;
        } catch (_) {}
      } else if (json['metadata'] is Map) {
        metadataMap = Map<String, dynamic>.from(json['metadata'] as Map);
      }
    }

    return Attendance(
      id: (json['id'] ?? '').toString(),
      employeeId: (json['employee_id'] ?? '').toString(),
      date: (json['date'] ?? '').toString(),
      checkIn: DateTime.tryParse(json['check_in']?.toString() ?? '') ?? DateTime.now(),
      checkOut: json['check_out'] != null 
          ? DateTime.tryParse(json['check_out'].toString()) 
          : null,
      hoursWorked: json['hours_worked'] != null 
          ? double.tryParse(json['hours_worked'].toString()) 
          : null,
      status: (json['status'] ?? 'present').toString(),
      checkInLat: json['check_in_lat'] != null 
          ? double.tryParse(json['check_in_lat'].toString()) 
          : null,
      checkInLng: json['check_in_lng'] != null 
          ? double.tryParse(json['check_in_lng'].toString()) 
          : null,
      checkOutLat: json['check_out_lat'] != null 
          ? double.tryParse(json['check_out_lat'].toString()) 
          : null,
      checkOutLng: json['check_out_lng'] != null 
          ? double.tryParse(json['check_out_lng'].toString()) 
          : null,
      metadata: metadataMap,
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

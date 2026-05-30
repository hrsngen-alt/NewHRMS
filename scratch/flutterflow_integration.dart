// ====================================================================
// FLUTTERFLOW CUSTOM CODE INTEGRATION
// Copy-paste these snippets into FlutterFlow's Custom Code / Custom Actions
// ====================================================================

import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseRedisIntegration {
  static const String supabaseUrl = 'https://youbawkwslbaydxbjame.supabase.co';
  static const String anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjA5NjAsImV4cCI6MjA5Mzg5Njk2MH0.sENCk7EiY9fqHXZfRpZaAGLERWUMHbAUK37ObG8zXTE';

  // ====================================================================
  // 1. CUSTOM ACTION: FETCH CACHED EMPLOYEES
  // Use this in FlutterFlow to get your Redis-cached Employees list.
  // Return Type: List<dynamic> (or List<JSON> in FlutterFlow)
  // ====================================================================
  static Future<List<dynamic>> fetchCachedEmployees() async {
    final url = Uri.parse('$supabaseUrl/functions/v1/employees-cached');
    
    try {
      final response = await http.get(
        url,
        headers: {
          'apikey': anonKey,
          'Authorization': 'Bearer $anonKey',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final payload = jsonDecode(response.body);
        final dynamic rawData = payload['data'];
        
        // If the Edge function returned stringified JSON from Redis, parse it
        if (rawData is String) {
          return jsonDecode(rawData) as List<dynamic>;
        }
        return rawData as List<dynamic>;
      } else {
        throw Exception('Failed to load employees: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ Error fetching cached employees: $e');
      return [];
    }
  }

  // ====================================================================
  // 2. CUSTOM ACTION: FETCH CACHED ATTENDANCE
  // Use this in FlutterFlow to retrieve role-based cached attendance.
  // Parameters: 
  //   - String role ("admin" or "employee")
  //   - String employeeId
  // ====================================================================
  static Future<List<dynamic>> fetchCachedAttendance(String role, String employeeId) async {
    final url = Uri.parse('$supabaseUrl/functions/v1/attendance-cached?role=$role&employee_id=$employeeId');
    
    try {
      final response = await http.get(
        url,
        headers: {
          'apikey': anonKey,
          'Authorization': 'Bearer $anonKey',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final payload = jsonDecode(response.body);
        final dynamic rawData = payload['data'];
        
        if (rawData is String) {
          return jsonDecode(rawData) as List<dynamic>;
        }
        return rawData as List<dynamic>;
      } else {
        throw Exception('Failed to load attendance logs: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ Error fetching cached attendance: $e');
      return [];
    }
  }

  // ====================================================================
  // 3. CUSTOM ACTION: FETCH CACHED SALARY STRUCTURES
  // Use this in FlutterFlow to fetch the active salary structure listing.
  // ====================================================================
  static Future<List<dynamic>> fetchCachedSalaryStructures() async {
    final url = Uri.parse('$supabaseUrl/functions/v1/salary-structure-cached');
    
    try {
      final response = await http.get(
        url,
        headers: {
          'apikey': anonKey,
          'Authorization': 'Bearer $anonKey',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final payload = jsonDecode(response.body);
        final dynamic rawData = payload['data'];
        
        if (rawData is String) {
          return jsonDecode(rawData) as List<dynamic>;
        }
        return rawData as List<dynamic>;
      } else {
        throw Exception('Failed to load salary structures: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ Error fetching cached salary structures: $e');
      return [];
    }
  }

  // ====================================================================
  // 4. CUSTOM ACTION: SUBMIT CLOCK-IN WITH LOCATION
  // Use this to log device GPS coordinates and clock in/out an employee.
  // (Note: This writes directly to Supabase, which triggers the Postgres Webhook
  //  to invalidate the Redis cache instantly!)
  // Parameters:
  //   - String employeeId
  //   - double latitude
  //   - double longitude
  // ====================================================================
  static Future<bool> clockInEmployee(String employeeId, double latitude, double longitude) async {
    final client = SupabaseClient(supabaseUrl, anonKey);
    final todayStr = DateTime.now().toIso8601String().substring(0, 10); // YYYY-MM-DD
    
    try {
      await client.from('attendance').insert({
        'employee_id': employeeId,
        'date': todayStr,
        'check_in': DateTime.now().toUtc().toIso8601String(),
        'status': 'present',
        'check_in_lat': latitude,
        'check_in_lng': longitude,
        'metadata': {'mode': 'mobile'}
      });
      
      print('✅ Mobile shift started successfully!');
      return true;
    } catch (e) {
      print('❌ Error starting mobile shift: $e');
      return false;
    }
  }
}

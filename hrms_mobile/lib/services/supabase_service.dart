import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/employee.dart';
import '../models/attendance.dart';

class SupabaseService {
  static final SupabaseService _instance = SupabaseService._internal();
  factory SupabaseService() => _instance;
  SupabaseService._internal();

  static const String supabaseUrl = 'https://youbawkwslbaydxbjame.supabase.co';
  static const String anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjA5NjAsImV4cCI6MjA5Mzg5Njk2MH0.sENCk7EiY9fqHXZfRpZaAGLERWUMHbAUK37ObG8zXTE';

  final SupabaseClient client = Supabase.instance.client;

  // Initialize Supabase Client
  static Future<void> initialize() async {
    await Supabase.initialize(
      url: supabaseUrl,
      anonKey: anonKey,
    );
  }

  // ====================================================================
  // AUTHENTICATION SERVICES
  // ====================================================================

  Future<AuthResponse> signIn(String email, String password) async {
    return await client.auth.signInWithPassword(email: email, password: password);
  }

  Future<void> signOut() async {
    await client.auth.signOut();
  }

  Session? get currentSession => client.auth.currentSession;
  User? get currentUser => client.auth.currentUser;

  // Get active linked employee profile based on User Auth UUID
  Future<Employee?> getLinkedEmployeeProfile() async {
    final user = currentUser;
    if (user == null) return null;

    try {
      final response = await client
          .from('employees')
          .select()
          .eq('email', user.email!)
          .maybeSingle();

      if (response != null) {
        return Employee.fromJson(response as Map<String, dynamic>);
      }
    } catch (e) {
      print("❌ Error fetching linked employee profile: $e");
    }
    
    // Self-healing fallback: Return a temporary profile so the mobile app
    // never crashes even if the DB employees record hasn't synced yet!
    return Employee(
      id: user.id,
      fullName: user.email!.split('@').first.toUpperCase(),
      email: user.email!,
      employeeCode: "EMP-TEMP",
      department: "Staff",
      designation: "Member",
      phone: "",
      basicSalary: 0.0,
      hra: 0.0,
      bonus: 0.0,
      pfAmount: 0.0,
      esicAmount: 0.0,
      gratuityAmount: 0.0,
      status: "active",
    );
  }

  // Resolve user role
  Future<String> getUserRole() async {
    final profile = await getLinkedEmployeeProfile();
    if (profile == null) return 'employee';
    
    // In our system, role checks are based on emails or departments, 
    // or standard role logic. Let's inspect email for admin or standard role flags
    if (profile.email == 'admin@sngene.com' ||
        profile.email == 'admin12@pulse.com' ||
        profile.department?.toLowerCase() == 'hr') {
      return 'admin';
    }
    return 'employee';
  }

  // ====================================================================
  // REDIS CACHED API CALLS (EDGE FUNCTIONS)
  // ====================================================================

  // Fetch cached employees directory list
  Future<List<Employee>> getCachedEmployees() async {
    final url = Uri.parse('$supabaseUrl/functions/v1/employees-cached');
    try {
      final response = await http.get(
        url,
        headers: {
          'apikey': anonKey,
          'Authorization': 'Bearer $anonKey',
        },
      );

      if (response.statusCode == 200) {
        final Map<String, dynamic> body = jsonDecode(response.body);
        final dynamic rawData = body['data'];
        
        List<dynamic> list = [];
        if (rawData is String) {
          list = jsonDecode(rawData) as List<dynamic>;
        } else {
          list = rawData as List<dynamic>;
        }

        return list.map((item) => Employee.fromJson(item as Map<String, dynamic>)).toList();
      }
    } catch (e) {
      print("❌ Error calling employees-cached Edge Function: $e");
    }
    return [];
  }

  // Fetch cached attendance records (role-based)
  Future<List<Attendance>> getCachedAttendance(String role, String employeeId) async {
    final url = Uri.parse('$supabaseUrl/functions/v1/attendance-cached?role=$role&employee_id=$employeeId');
    try {
      final response = await http.get(
        url,
        headers: {
          'apikey': anonKey,
          'Authorization': 'Bearer $anonKey',
        },
      );

      if (response.statusCode == 200) {
        final Map<String, dynamic> body = jsonDecode(response.body);
        final dynamic rawData = body['data'];

        List<dynamic> list = [];
        if (rawData is String) {
          list = jsonDecode(rawData) as List<dynamic>;
        } else {
          list = rawData as List<dynamic>;
        }

        return list.map((item) => Attendance.fromJson(item as Map<String, dynamic>)).toList();
      }
    } catch (e) {
      print("❌ Error calling attendance-cached Edge Function: $e");
    }
    return [];
  }

  // Fetch cached salary structures (active list)
  Future<List<Employee>> getCachedSalaryStructures() async {
    final url = Uri.parse('$supabaseUrl/functions/v1/salary-structure-cached');
    try {
      final response = await http.get(
        url,
        headers: {
          'apikey': anonKey,
          'Authorization': 'Bearer $anonKey',
        },
      );

      if (response.statusCode == 200) {
        final Map<String, dynamic> body = jsonDecode(response.body);
        final dynamic rawData = body['data'];

        List<dynamic> list = [];
        if (rawData is String) {
          list = jsonDecode(rawData) as List<dynamic>;
        } else {
          list = rawData as List<dynamic>;
        }

        return list.map((item) => Employee.fromJson(item as Map<String, dynamic>)).toList();
      }
    } catch (e) {
      print("❌ Error calling salary-structure-cached Edge Function: $e");
    }
    return [];
  }

  // ====================================================================
  // ATTENDANCE PUNCH ACTIONS
  // These directly manipulate PostgreSQL database, firing triggers 
  // to clear the Redis Cloud cache!
  // ====================================================================

  Future<void> punchIn(String employeeId, double lat, double lng, bool isFieldMode) async {
    final todayStr = DateTime.now().toIso8601String().substring(0, 10);
    await client.from('attendance').insert({
      'employee_id': employeeId,
      'date': todayStr,
      'check_in': DateTime.now().toUtc().toIso8601String(),
      'status': 'present',
      'check_in_lat': lat,
      'check_in_lng': lng,
      'metadata': {'mode': isFieldMode ? 'field' : 'office', 'client': 'mobile'}
    });
  }

  Future<void> punchOut(String attendanceId, DateTime checkIn, double lat, double lng) async {
    final start = checkIn.millisecondsSinceEpoch;
    final diff = DateTime.now().millisecondsSinceEpoch - start;
    final hours = (diff / 3600000.0).clamp(0.0, 24.0);

    await client.from('attendance').update({
      'check_out': DateTime.now().toUtc().toIso8601String(),
      'hours_worked': double.parse(hours.toStringAsFixed(2)),
      'check_out_lat': lat,
      'check_out_lng': lng,
    }).eq('id', attendanceId);
  }
}

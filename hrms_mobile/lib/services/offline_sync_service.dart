import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'supabase_service.dart';

class OfflineSyncService {
  static final OfflineSyncService _instance = OfflineSyncService._internal();
  factory OfflineSyncService() => _instance;
  OfflineSyncService._internal();

  static const String _fileName = 'pending_punches.json';

  // Get local file reference
  Future<File> get _localFile async {
    final directory = await getApplicationDocumentsDirectory();
    return File('${directory.path}/$_fileName');
  }

  // Save a pending punch (clock-in or clock-out) offline
  Future<void> savePendingPunch(Map<String, dynamic> punch) async {
    try {
      final file = await _localFile;
      List<dynamic> list = [];
      
      if (await file.exists()) {
        final content = await file.readAsString();
        if (content.isNotEmpty) {
          list = jsonDecode(content) as List<dynamic>;
        }
      }
      
      list.add(punch);
      await file.writeAsString(jsonEncode(list));
      print("💾 Successfully cached punch offline: $punch");
    } catch (e) {
      print("❌ Error saving pending punch locally: $e");
    }
  }

  // Retrieve cached pending punches
  Future<List<Map<String, dynamic>>> getPendingPunches() async {
    try {
      final file = await _localFile;
      if (!await file.exists()) return [];

      final content = await file.readAsString();
      if (content.isEmpty) return [];

      final list = jsonDecode(content) as List<dynamic>;
      return list.map((item) => Map<String, dynamic>.from(item as Map)).toList();
    } catch (e) {
      print("❌ Error reading pending punches: $e");
      return [];
    }
  }

  // Clear local cache file
  Future<void> clearPendingPunches() async {
    try {
      final file = await _localFile;
      if (await file.exists()) {
        await file.writeAsString('[]');
      }
    } catch (e) {
      print("❌ Error clearing local punch file: $e");
    }
  }

  // Attempt to sync pending punches with Supabase in background
  Future<bool> syncPendingPunches() async {
    final pending = await getPendingPunches();
    if (pending.isEmpty) return true;

    print("⚡ Found ${pending.length} pending punches. Attempting sync...");
    final supabase = SupabaseService();

    try {
      // Loop sequentially (dependencies check-in before check-out)
      for (final punch in pending) {
        final String type = (punch['type'] ?? '').toString();
        final String employeeId = (punch['employee_id'] ?? '').toString();
        final double lat = double.tryParse(punch['lat']?.toString() ?? '') ?? 0.0;
        final double lng = double.tryParse(punch['lng']?.toString() ?? '') ?? 0.0;
        final String timestamp = (punch['timestamp'] ?? '').toString();

        if (type == 'in') {
          final bool isFieldMode = punch['is_field'] == true;
          
          // Re-insert exact offline timestamp in metadata
          await supabase.client.from('attendance').insert({
            'employee_id': employeeId,
            'date': timestamp.length >= 10 ? timestamp.substring(0, 10) : DateTime.now().toIso8601String().substring(0, 10),
            'check_in': timestamp,
            'status': 'present',
            'check_in_lat': lat,
            'check_in_lng': lng,
            'metadata': {
              'mode': isFieldMode ? 'field' : 'office',
              'client': 'mobile-offline',
              'actual_punch_time': timestamp
            }
          });
        } else if (type == 'out') {
          // Find the active check-in session for this employee to update it
          final activeRes = await supabase.client
              .from('attendance')
              .select('id, check_in')
              .eq('employee_id', employeeId)
              .filter('check_out', 'is', null)
              .maybeSingle();

          if (activeRes != null) {
            final String attendanceId = (activeRes['id'] ?? '').toString();
            final DateTime checkIn = DateTime.tryParse(activeRes['check_in']?.toString() ?? '') ?? DateTime.now();
            final int start = checkIn.millisecondsSinceEpoch;
            final int diff = DateTime.tryParse(timestamp)?.millisecondsSinceEpoch ?? (DateTime.now().millisecondsSinceEpoch) - start;
            final double hours = (diff / 3600000.0).clamp(0.0, 24.0);

            await supabase.client.from('attendance').update({
              'check_out': timestamp,
              'hours_worked': double.parse(hours.toStringAsFixed(2)),
              'check_out_lat': lat,
              'check_out_lng': lng,
            }).eq('id', attendanceId);
          }
        }
      }
      
      // Successfully synced all! Clear the local file.
      await clearPendingPunches();
      print("🎉 Offline sync successfully completed! Cached records updated in Supabase.");
      return true;
    } catch (e) {
      print("❌ Offline sync failed: $e. Punches kept in local storage.");
      return false;
    }
  }
}

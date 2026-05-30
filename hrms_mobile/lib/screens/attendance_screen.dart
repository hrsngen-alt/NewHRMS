import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../providers/attendance_provider.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({Key? key}) : super(key: key);

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  bool _isFieldMode = false;

  Future<void> _handleClockInOut() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final attendance = Provider.of<AttendanceProvider>(context, listen: false);
    final employee = auth.currentEmployee;

    if (employee == null) return;

    bool success;
    if (attendance.isClockedIn) {
      success = await attendance.checkOut(employee.id);
    } else {
      success = await attendance.checkIn(employee.id, _isFieldMode);
    }

    if (mounted) {
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(attendance.isClockedIn ? "Shift started! ⚡" : "Shift ended! 💾"),
            backgroundColor: attendance.isClockedIn ? Colors.indigo : Colors.teal,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(attendance.errorMessage ?? "Attendance update failed."),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final attendance = Provider.of<AttendanceProvider>(context);
    final employee = auth.currentEmployee;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SafeArea(
        child: Column(
          children: [
            // 1. TOP APP BAR
            Padding(
              padding: const EdgeInsets.all(24.0),
              child: Row(
                children: [
                  const Icon(Icons.timer_outlined, color: Color(0xFF818CF8), size: 24),
                  const SizedBox(width: 12),
                  Text(
                    "CLOCK WORK",
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      letterSpacing: -0.5,
                    ),
                  ),
                ],
              ),
            ),

            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // 2. FIELD MODE SWITCH
                    if (!attendance.isClockedIn)
                      Container(
                        margin: const EdgeInsets.only(bottom: 32),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.02),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.white.withOpacity(0.05)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.airport_shuttle_outlined, color: Colors.amberAccent, size: 20),
                                const SizedBox(width: 12),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      "FIELD CLOCK-IN",
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      "Clock in outside office limits",
                                      style: TextStyle(
                                        color: Colors.white.withOpacity(0.4),
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            Switch(
                              value: _isFieldMode,
                              onChanged: (val) => setState(() => _isFieldMode = val),
                              activeColor: Colors.amberAccent,
                              activeTrackColor: Colors.amberAccent.withOpacity(0.3),
                            ),
                          ],
                        ),
                      ),

                    // 3. MAIN CLOCK BUTTON
                    Center(
                      child: Container(
                        width: 240,
                        height: 240,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withOpacity(0.01),
                          border: Border.all(
                            color: attendance.isClockedIn 
                                ? Colors.redAccent.withOpacity(0.15) 
                                : const Color(0xFF6366F1).withOpacity(0.15),
                            width: 12,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: attendance.isClockedIn 
                                  ? Colors.redAccent.withOpacity(0.05) 
                                  : const Color(0xFF6366F1).withOpacity(0.05),
                              blurRadius: 40,
                            ),
                          ],
                        ),
                        child: InkWell(
                          onTap: attendance.isLoading ? null : _handleClockInOut,
                          customBorder: const CircleBorder(),
                          child: Center(
                            child: Container(
                              width: 190,
                              height: 190,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: LinearGradient(
                                  colors: attendance.isClockedIn
                                      ? [const Color(0xFFEF4444), const Color(0xFFB91C1C)]
                                      : [const Color(0xFF6366F1), const Color(0xFF4F46E5)],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: attendance.isClockedIn
                                        ? Colors.redAccent.withOpacity(0.3)
                                        : const Color(0xFF6366F1).withOpacity(0.3),
                                    blurRadius: 20,
                                    offset: const Offset(0, 5),
                                  ),
                                ],
                              ),
                              child: Center(
                                child: attendance.isLoading
                                    ? const CircularProgressIndicator(
                                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                        strokeWidth: 3,
                                      )
                                    : Column(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Icon(
                                            attendance.isClockedIn ? Icons.stop_rounded : Icons.play_arrow_rounded,
                                            color: Colors.white,
                                            size: 48,
                                          ),
                                          const SizedBox(height: 8),
                                          Text(
                                            attendance.isClockedIn ? "FINISH SHIFT" : "START SHIFT",
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 12,
                                              fontWeight: FontWeight.w900,
                                              letterSpacing: 1.0,
                                            ),
                                          ),
                                          if (attendance.isClockedIn) ...[
                                            const SizedBox(height: 8),
                                            Text(
                                              attendance.elapsedTime,
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 18,
                                                fontWeight: FontWeight.w900,
                                                fontFamily: 'monospace',
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 48),

                    // 4. TODAY'S SHIFT TIMELINE LOGS
                    Text(
                      "TODAY'S TIMELINE LOGS",
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        color: Colors.white.withOpacity(0.4),
                        letterSpacing: 2.0,
                      ),
                    ),
                    const SizedBox(height: 16),
                    _buildLogsList(attendance),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLogsList(AttendanceProvider attendance) {
    final todayStr = DateTime.now().toIso8601String().substring(0, 10);
    final todayLogs = attendance.records.where((r) => r.date == todayStr).toList();

    if (todayLogs.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.01),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.white.withOpacity(0.03)),
        ),
        child: Center(
          child: Column(
            children: [
              Icon(Icons.info_outline_rounded, color: Colors.white.withOpacity(0.2), size: 32),
              const SizedBox(height: 12),
              Text(
                "No shift logs recorded for today.",
                style: TextStyle(
                  color: Colors.white.withOpacity(0.3),
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: todayLogs.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final log = todayLogs[index];
        final timeFormatter = DateFormat('hh:mm:ss a');
        final inStr = timeFormatter.format(log.checkIn.toLocal());
        final outStr = log.checkOut != null ? timeFormatter.format(log.checkOut!.toLocal()) : "ACTIVE";

        return Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.02),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withOpacity(0.05)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "CHECK-IN / OUT SESSION",
                    style: TextStyle(
                      fontSize: 8,
                      fontWeight: FontWeight.w900,
                      color: Colors.white.withOpacity(0.3),
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    "$inStr ↔ $outStr",
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    "PRODUCTION",
                    style: TextStyle(
                      fontSize: 8,
                      fontWeight: FontWeight.w900,
                      color: Colors.white.withOpacity(0.3),
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    log.hoursWorked != null ? "${log.hoursWorked} hrs" : "ONGOING",
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w900,
                      color: log.hoursWorked != null ? const Color(0xFF818CF8) : Colors.greenAccent,
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}

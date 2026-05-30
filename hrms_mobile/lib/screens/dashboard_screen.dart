import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../providers/attendance_provider.dart';
import '../providers/theme_provider.dart';
import '../services/payslip_share_service.dart';
import '../services/offline_sync_service.dart';
import 'main_shell.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({Key? key}) : super(key: key);

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _activeTab = 0; // 0: Me, 1: Inbox
  String _currentTime = "";
  String _currentDate = "";
  Timer? _clockTimer;
  int _pendingOfflineCount = 0;
  bool _isSyncing = false;

  @override
  void initState() {
    super.initState();
    _updateClock();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      _updateClock();
    });
    _fetchPendingOfflineCount();
  }

  @override
  void dispose() {
    _clockTimer?.cancel();
    super.dispose();
  }

  void _updateClock() {
    final now = DateTime.now();
    final timeStr = DateFormat('hh:mm:ss a').format(now);
    final dateStr = DateFormat('EEEE, d MMMM yyyy').format(now);
    if (mounted) {
      setState(() {
        _currentTime = timeStr;
        _currentDate = dateStr;
      });
    }
  }

  Future<void> _fetchPendingOfflineCount() async {
    try {
      final punches = await OfflineSyncService().getPendingPunches();
      if (mounted) {
        setState(() {
          _pendingOfflineCount = punches.length;
        });
      }
    } catch (_) {}
  }

  Future<void> _triggerManualSync() async {
    if (_isSyncing) return;
    setState(() => _isSyncing = true);
    
    final scaffold = ScaffoldMessenger.of(context);
    try {
      final success = await OfflineSyncService().syncPendingPunches();
      if (!mounted) return;
      if (success) {
        scaffold.showSnackBar(
          const SnackBar(
            content: Text("🎉 Offline punches successfully synced with server!"),
            backgroundColor: Colors.teal,
          ),
        );
        _fetchPendingOfflineCount();
        final auth = Provider.of<AuthProvider>(context, listen: false);
        if (auth.currentEmployee != null) {
          Provider.of<AttendanceProvider>(context, listen: false).fetchAttendanceLogs(
            auth.role,
            auth.currentEmployee!.id,
          );
        }
      } else {
        scaffold.showSnackBar(
          const SnackBar(
            content: Text("❌ Failed to sync: check server connection."),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } catch (e) {
      scaffold.showSnackBar(
        SnackBar(
          content: Text("❌ Sync error: $e"),
          backgroundColor: Colors.redAccent,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isSyncing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final attendance = Provider.of<AttendanceProvider>(context);
    final themeProvider = Provider.of<ThemeProvider>(context);
    final employee = auth.currentEmployee;
    final isDark = themeProvider.isDark;

    // Theme responsive design values
    final Color scaffoldBg = isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9);
    final Color cardBg = isDark ? Colors.white.withOpacity(0.03) : Colors.white;
    final Color borderBg = isDark ? Colors.white.withOpacity(0.06) : const Color(0xFFE2E8F0);
    final Color textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final Color subtitleColor = isDark ? Colors.white.withOpacity(0.4) : const Color(0xFF64748B);

    return Scaffold(
      backgroundColor: scaffoldBg,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            if (employee != null) {
              await attendance.fetchAttendanceLogs(auth.role, employee.id);
            }
            await _fetchPendingOfflineCount();
          },
          color: const Color(0xFF6366F1),
          backgroundColor: cardBg,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 1. BRAND HEADER & PROFILE AVATAR
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const SnLogo(size: 38),
                        const SizedBox(width: 12),
                        Text(
                          "SN Gene HR",
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.5,
                            color: textColor,
                          ),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        // Quick Sync Indicator if offline sync has pending
                        if (_pendingOfflineCount > 0)
                          IconButton(
                            onPressed: _triggerManualSync,
                            icon: Badge(
                              label: Text(_pendingOfflineCount.toString()),
                              child: Icon(Icons.sync_problem_rounded, color: Colors.orangeAccent, size: 24),
                            ),
                          ),
                        const SizedBox(width: 8),
                        // Quick Theme Toggle
                        IconButton(
                          onPressed: () => themeProvider.toggleTheme(),
                          icon: Icon(
                            isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
                            color: textColor,
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Profile Avatar
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: const Color(0xFF6366F1).withOpacity(0.08),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: borderBg),
                          ),
                          child: Center(
                            child: Text(
                              employee?.fullName.substring(0, 1).toUpperCase() ?? "E",
                              style: const TextStyle(
                                color: Color(0xFF6366F1),
                                fontSize: 16,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // 2. KEKA STYLE TAB SELECTOR (Me vs Inbox)
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: isDark ? Colors.white.withOpacity(0.02) : const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _activeTab = 0),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: _activeTab == 0 
                                  ? (isDark ? const Color(0xFF1E293B) : Colors.white)
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Center(
                              child: Text(
                                "Me",
                                style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 14,
                                  color: _activeTab == 0 ? textColor : subtitleColor,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _activeTab = 1),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: _activeTab == 1 
                                  ? (isDark ? const Color(0xFF1E293B) : Colors.white)
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Center(
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    "Inbox",
                                    style: TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 14,
                                      color: _activeTab == 1 ? textColor : subtitleColor,
                                    ),
                                  ),
                                  if (_pendingOfflineCount > 0) ...[
                                    const SizedBox(width: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: Colors.orangeAccent,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        _pendingOfflineCount.toString(),
                                        style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.black),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // 3. TAB VIEWS
                _activeTab == 0 ? _buildMeTabContent() : _buildInboxTabContent(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ====================================================================
  // "ME" TAB CONTENT (KEKA HOME DASHBOARD COPY)
  // ====================================================================
  Widget _buildMeTabContent() {
    final auth = Provider.of<AuthProvider>(context);
    final attendance = Provider.of<AttendanceProvider>(context);
    final themeProvider = Provider.of<ThemeProvider>(context);
    final employee = auth.currentEmployee;
    final isDark = themeProvider.isDark;

    final Color cardBg = isDark ? Colors.white.withOpacity(0.02) : Colors.white;
    final Color borderBg = isDark ? Colors.white.withOpacity(0.05) : const Color(0xFFE2E8F0);
    final Color textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final Color subtitleColor = isDark ? Colors.white.withOpacity(0.4) : const Color(0xFF64748B);
    final BoxShadow cardShadow = isDark 
        ? const BoxShadow(color: Colors.transparent)
        : BoxShadow(
            color: const Color(0xFF0F172A).withOpacity(0.04),
            blurRadius: 24,
            offset: const Offset(0, 8),
          );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 1. WELCOME GREETING
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "GREETINGS,",
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: subtitleColor,
                    letterSpacing: 2.0,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  employee?.fullName.split(' ').first.toUpperCase() ?? "EMPLOYEE",
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    color: textColor,
                    letterSpacing: -0.5,
                  ),
                ),
              ],
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                children: [
                  Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 12),
                  SizedBox(width: 6),
                  Text(
                    "On Duty",
                    style: TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),

        // 2. KEKA SWIPE IN CARD (Interactive Web Punch Card)
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: borderBg),
            boxShadow: [cardShadow],
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.watch_later_outlined, color: Color(0xFF6366F1), size: 16),
                      const SizedBox(width: 8),
                      Text(
                        "SHIFT: 09:30 AM - 06:30 PM",
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          color: subtitleColor,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                  Text(
                    "GENERAL",
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF6366F1).withOpacity(0.8),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              // Big Live Running Clock Display
              Text(
                _currentTime,
                style: TextStyle(
                  fontSize: 34,
                  fontWeight: FontWeight.w900,
                  color: textColor,
                  letterSpacing: -1.0,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _currentDate,
                style: TextStyle(
                  fontSize: 12,
                  color: subtitleColor,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 24),
              // Punch Status Indicators
              attendance.isClockedIn
                  ? Container(
                      padding: const EdgeInsets.all(16),
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withOpacity(0.08),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.fiber_manual_record, color: Color(0xFF10B981), size: 12),
                          const SizedBox(width: 8),
                          Text(
                            "SWIPED IN AT: ${DateFormat('hh:mm a').format(attendance.activeShift?.checkIn.toLocal() ?? DateTime.now())}",
                            style: const TextStyle(
                              color: Color(0xFF10B981),
                              fontSize: 11,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    )
                  : Container(
                      padding: const EdgeInsets.all(16),
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        color: const Color(0xFF6366F1).withOpacity(0.08),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Center(
                        child: Text(
                          "PUNCH IN TO START YOUR PRODUCTION TIMERS",
                          style: TextStyle(
                            color: const Color(0xFF6366F1).withOpacity(0.8),
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ),
              
              // Keka-style Large Action Button (Web Swipe Button)
              GestureDetector(
                onTap: () {
                  // Switch tab immediately to Attendance tab (Index 1) for geofenced punching check!
                  MainShell.selectedIndexNotifier.value = 1;
                },
                child: Container(
                  height: 56,
                  decoration: BoxDecoration(
                    gradient: attendance.isClockedIn
                        ? const LinearGradient(colors: [Color(0xFFEF4444), Color(0xFFDC2626)])
                        : const LinearGradient(colors: [Color(0xFF6366F1), Color(0xFF4F46E5)]),
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: [
                      BoxShadow(
                        color: attendance.isClockedIn
                            ? Colors.redAccent.withOpacity(0.3)
                            : const Color(0xFF6366F1).withOpacity(0.3),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Center(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          attendance.isClockedIn ? Icons.exit_to_app_rounded : Icons.login_rounded,
                          color: Colors.white,
                          size: 20,
                        ),
                        const SizedBox(width: 12),
                        Text(
                          attendance.isClockedIn 
                              ? "WEB SWIPE OUT (${attendance.elapsedTime})" 
                              : "WEB SWIPE IN",
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.0,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),

        // 3. QUICK ACTIONS GRID (KEKA ICON TILES)
        Text(
          "QUICK PORTAL ACTIONS",
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w900,
            color: subtitleColor,
            letterSpacing: 2.0,
          ),
        ),
        const SizedBox(height: 12),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          childAspectRatio: 1.25,
          children: [
            _buildKekaQuickCard(
              label: "Apply Leave",
              description: "Request leaves & WFH",
              icon: Icons.flight_takeoff_rounded,
              color: Colors.orange,
              onTap: _showApplyLeaveSheet,
            ),
            _buildKekaQuickCard(
              label: "Clock Work",
              description: "Punch logs & map",
              icon: Icons.add_location_alt_rounded,
              color: const Color(0xFF6366F1),
              onTap: () {
                MainShell.selectedIndexNotifier.value = 1;
              },
            ),
            _buildKekaQuickCard(
              label: "Payslip Portal",
              description: "Share & print payslip",
              icon: Icons.account_balance_wallet_rounded,
              color: const Color(0xFF10B981),
              onTap: () {
                if (employee != null) {
                  PayslipShareService.sharePayslip(employee);
                }
              },
            ),
            _buildKekaQuickCard(
              label: "Weekly Shift",
              description: "Timings & calendar",
              icon: Icons.calendar_today_rounded,
              color: Colors.purple,
              onTap: _showShiftDetailsSheet,
            ),
          ],
        ),
        const SizedBox(height: 32),

        // 4. MY TIMINGS & WEEKLY ATTENDANCE DOTS
        Text(
          "WEEKLY PERFORMANCE SUMMARY",
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w900,
            color: subtitleColor,
            letterSpacing: 2.0,
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: borderBg),
            boxShadow: [cardShadow],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    "Attendance Track",
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    "Current Week (Mon - Fri)",
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: subtitleColor),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildDayDot("Mon", "Present", Colors.green, true),
                  _buildDayDot("Tue", "Present", Colors.green, true),
                  _buildDayDot("Wed", "Present", Colors.green, true),
                  _buildDayDot("Thu", "Present", Colors.green, true),
                  _buildDayDot("Fri", "Active", const Color(0xFF6366F1), attendance.isClockedIn),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),

        // 5. CELEBRATION FEED CAROUSEL
        Text(
          "PULSE COMMUNITY",
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w900,
            color: subtitleColor,
            letterSpacing: 2.0,
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 110,
          child: PageView(
            controller: PageController(viewportFraction: 0.95),
            children: [
              _buildCelebrateCard(
                title: "Work Anniversary Today! 🎉",
                subtitle: "Priyesh Patel completes 2 years as Lead Architect at SN Gene HR. Send congrats!",
                icon: Icons.star_purple500_rounded,
                color: Colors.amberAccent,
              ),
              _buildCelebrateCard(
                title: "Happy Birthday! 🎂",
                subtitle: "Karan Shah celebrating his birthday today! Send best wishes & greetings.",
                icon: Icons.cake_rounded,
                color: Colors.pinkAccent,
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),

        // 6. GENERAL NEWSFEED
        Text(
          "LATEST ANNOUNCEMENTS",
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w900,
            color: subtitleColor,
            letterSpacing: 2.0,
          ),
        ),
        const SizedBox(height: 12),
        _buildAnnouncementCard(
          title: "Welcome to SN Gene HR Mobile! 📱",
          content: "All features (attendance logs, geolocation checks, and payslips sharing parameters) are now accessible directly from your phone.",
          date: "MAY 30, 2026",
        ),
        const SizedBox(height: 16),
        _buildAnnouncementCard(
          title: "Offline Synced Punch Support",
          content: "Our system detects cellular disconnect and saves your punch actions locally. The app auto-syncs when reconnecting.",
          date: "MAY 30, 2026",
        ),
      ],
    );
  }

  // ====================================================================
  // "INBOX" TAB CONTENT (KEKA INBOX COPY WITH MANUAL SYNC TRIGGER)
  // ====================================================================
  Widget _buildInboxTabContent() {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDark;

    final Color cardBg = isDark ? Colors.white.withOpacity(0.02) : Colors.white;
    final Color borderBg = isDark ? Colors.white.withOpacity(0.05) : const Color(0xFFE2E8F0);
    final Color textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final Color subtitleColor = isDark ? Colors.white.withOpacity(0.4) : const Color(0xFF64748B);
    final BoxShadow cardShadow = isDark 
        ? const BoxShadow(color: Colors.transparent)
        : BoxShadow(
            color: const Color(0xFF0F172A).withOpacity(0.04),
            blurRadius: 24,
            offset: const Offset(0, 8),
          );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              "APPROVALS & SYNC QUEUES",
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: subtitleColor,
                letterSpacing: 2.0,
              ),
            ),
            if (_pendingOfflineCount > 0)
              TextButton.icon(
                onPressed: _triggerManualSync,
                icon: _isSyncing 
                    ? const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF6366F1)))
                    : const Icon(Icons.sync_rounded, size: 14),
                label: Text(_isSyncing ? "Syncing..." : "Sync Now", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
              ),
          ],
        ),
        const SizedBox(height: 12),

        // Display Pending Punches
        if (_pendingOfflineCount > 0) ...[
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFFEF4444).withOpacity(0.05),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.redAccent.withOpacity(0.2)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Icon(Icons.wifi_off_rounded, color: Colors.orangeAccent, size: 20),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            "Pending Offline Sync Queue",
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Colors.redAccent),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            "You have $_pendingOfflineCount pending punches recorded while offline.",
                            style: TextStyle(fontSize: 11, color: textColor.withOpacity(0.7)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _triggerManualSync,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6366F1),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text("FORCE SYNCHRONIZATION NOW", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
        ],

        // Inbox Empty Glass Card
        Container(
          padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: borderBg),
            boxShadow: [cardShadow],
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withOpacity(0.08),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.done_all_rounded,
                  color: Color(0xFF10B981),
                  size: 32,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                "All Caught Up!",
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: textColor,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                "You have no pending leave approvals, asset allocations, or action items in your workspace inbox today.",
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12,
                  color: subtitleColor,
                  height: 1.5,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ====================================================================
  // SUB-WIDGET BUILDERS
  // ====================================================================
  Widget _buildKekaQuickCard({
    required String label,
    required String description,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDark;
    final Color cardBg = isDark ? Colors.white.withOpacity(0.02) : Colors.white;
    final Color borderBg = isDark ? Colors.white.withOpacity(0.05) : const Color(0xFFE2E8F0);
    final Color textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final Color subtitleColor = isDark ? Colors.white.withOpacity(0.4) : const Color(0xFF64748B);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: borderBg),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 12),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w900,
                color: textColor,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              description,
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.bold,
                color: subtitleColor,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDayDot(String label, String status, Color color, bool isActive) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDark;
    final Color subtitleColor = isDark ? Colors.white.withOpacity(0.4) : const Color(0xFF64748B);
    final Color textColor = isDark ? Colors.white : const Color(0xFF0F172A);

    return Column(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: isActive ? color.withOpacity(0.12) : Colors.transparent,
            shape: BoxShape.circle,
            border: Border.all(
              color: isActive ? color : (isDark ? Colors.white.withOpacity(0.1) : const Color(0xFFCBD5E1)),
              width: isActive ? 2 : 1,
            ),
          ),
          child: Center(
            child: Icon(
              isActive ? Icons.check_rounded : Icons.fiber_manual_record_rounded,
              color: isActive ? color : (isDark ? Colors.white.withOpacity(0.2) : const Color(0xFF94A3B8)),
              size: isActive ? 16 : 10,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          label,
          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: textColor),
        ),
        const SizedBox(height: 2),
        Text(
          isActive ? status : "Pending",
          style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: isActive ? color : subtitleColor),
        ),
      ],
    );
  }

  Widget _buildCelebrateCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
  }) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDark;
    final Color cardBg = isDark ? Colors.white.withOpacity(0.02) : Colors.white;
    final Color borderBg = isDark ? Colors.white.withOpacity(0.05) : const Color(0xFFE2E8F0);
    final Color textColor = isDark ? Colors.white : const Color(0xFF0F172A);

    return Container(
      margin: const EdgeInsets.only(right: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: borderBg),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  title,
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: textColor),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: TextStyle(fontSize: 10, color: textColor.withOpacity(0.55), height: 1.3),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAnnouncementCard({
    required String title,
    required String content,
    required String date,
  }) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDark;
    final Color cardBg = isDark ? Colors.white.withOpacity(0.02) : Colors.white;
    final Color borderBg = isDark ? Colors.white.withOpacity(0.05) : const Color(0xFFE2E8F0);
    final Color textColor = isDark ? Colors.white : const Color(0xFF0F172A);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: borderBg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                date,
                style: const TextStyle(
                  fontSize: 8,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF6366F1),
                  letterSpacing: 1.0,
                ),
              ),
              const Icon(Icons.volume_up_outlined, color: Color(0xFF6366F1), size: 14),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            title,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w900,
              color: textColor,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            content,
            style: TextStyle(
              fontSize: 12,
              color: textColor.withOpacity(0.6),
              height: 1.5,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  // ====================================================================
  // MODAL BOTTOM SHEETS (LEAVES REQUEST & WEEKLY SHIFT DETAILS)
  // ====================================================================
  void _showApplyLeaveSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Provider.of<ThemeProvider>(context, listen: false).isDark ? const Color(0xFF1E293B) : Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text("Apply Leave or WFH", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
                ],
              ),
              const SizedBox(height: 16),
              const Text("LEAVE BALANCES:", style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey)),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildBalanceTile("Casual Leave", "5.0", Colors.orange),
                  _buildBalanceTile("Sick Leave", "3.0", Colors.redAccent),
                  _buildBalanceTile("Privilege Leave", "8.0", Colors.green),
                ],
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("Leave request raised successfully. Pending Manager approval.")),
                  );
                },
                icon: const Icon(Icons.flight_takeoff_rounded, color: Colors.white),
                label: const Text("Request Time Off (Casual Leave)", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.orange,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
              ),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("WFH authorization recorded. Geofencing bypassed for today.")),
                  );
                },
                icon: const Icon(Icons.home_work_rounded, color: Colors.white),
                label: const Text("Request Work From Home (WFH)", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6366F1),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildBalanceTile(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.15)),
      ),
      child: Column(
        children: [
          Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(fontSize: 10, color: Colors.grey)),
        ],
      ),
    );
  }

  void _showShiftDetailsSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Provider.of<ThemeProvider>(context, listen: false).isDark ? const Color(0xFF1E293B) : Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text("Weekly Shift Details", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
                ],
              ),
              const SizedBox(height: 16),
              _buildShiftTimingRow("Monday - Friday", "09:30 AM - 06:30 PM", "9.0 Hrs (General Shift)"),
              const SizedBox(height: 12),
              _buildShiftTimingRow("Saturday", "09:30 AM - 02:00 PM", "4.5 Hrs (Half Day)"),
              const SizedBox(height: 12),
              _buildShiftTimingRow("Sunday", "Weekly Off", "0 Hrs (Rest Day)"),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6366F1),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text("OK, GOT IT!", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildShiftTimingRow(String day, String timing, String duration) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(day, style: const TextStyle(fontWeight: FontWeight.bold)),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(timing, style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF6366F1))),
              const SizedBox(height: 2),
              Text(duration, style: const TextStyle(fontSize: 10, color: Colors.grey)),
            ],
          ),
        ],
      ),
    );
  }
}

// ====================================================================
// NATIVE VECTOR LOGO FOR SN GENE HRMS
// ====================================================================
class SnLogo extends StatelessWidget {
  final double size;
  const SnLogo({Key? key, this.size = 40}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        color: Color(0xFFE15B64), // Pink/Red Fan Color
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Stack(
          alignment: Alignment.center,
          children: [
            // White outline shadow
            Text(
              "SN",
              style: TextStyle(
                fontSize: size * 0.42,
                fontWeight: FontWeight.w900,
                fontFamily: "sans-serif",
                foreground: Paint()
                  ..style = PaintingStyle.stroke
                  ..strokeWidth = 3
                  ..color = Colors.white,
              ),
            ),
            // Light Blue text
            Text(
              "SN",
              style: TextStyle(
                fontSize: size * 0.42,
                fontWeight: FontWeight.w900,
                fontFamily: "sans-serif",
                color: const Color(0xFF0EA5E9), // Light Blue
              ),
            ),
          ],
        ),
      ),
    );
  }
}

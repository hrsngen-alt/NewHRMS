import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import '../services/payslip_share_service.dart';
import 'login_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({Key? key}) : super(key: key);

  Future<void> _handleLogout(BuildContext context) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    await auth.logout();
    if (context.mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final themeProvider = Provider.of<ThemeProvider>(context);
    final employee = auth.currentEmployee;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. TOP TITLE
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    "MY PROFILE",
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      letterSpacing: -0.5,
                    ),
                  ),
                  IconButton(
                    onPressed: () => _handleLogout(context),
                    icon: const Icon(Icons.logout_rounded, color: Colors.redAccent, size: 22),
                  ),
                ],
              ),
              const SizedBox(height: 32),

              // 2. PROFILE BANNER CARD
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [const Color(0xFF6366F1).withOpacity(0.1), const Color(0xFF4F46E5).withOpacity(0.02)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: const Color(0xFF6366F1).withOpacity(0.15)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: const Color(0xFF818CF8).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFF818CF8).withOpacity(0.2)),
                      ),
                      child: Center(
                        child: Text(
                          employee?.fullName.substring(0, 1).toUpperCase() ?? "E",
                          style: const TextStyle(
                            color: Color(0xFF818CF8),
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 20),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            employee?.fullName.toUpperCase() ?? "EMPLOYEE",
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            employee?.employeeCode ?? "CODE",
                            style: TextStyle(
                              fontSize: 11,
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.w900,
                              color: Colors.white.withOpacity(0.4),
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFF818CF8).withOpacity(0.1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              employee?.designation?.toUpperCase() ?? "STAFF MEMBER",
                              style: const TextStyle(
                                color: Color(0xFF818CF8),
                                fontSize: 9,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),

              // 3. CONTACT INFO SECTION
              _buildSectionHeader("PERSONAL & CONTACT"),
              const SizedBox(height: 12),
              _buildInfoContainer([
                _buildInfoRow("Email Address", employee?.email ?? "—"),
                _buildInfoRow("Phone Number", employee?.phone ?? "—"),
                _buildInfoRow("Department", employee?.department ?? "—"),
              ]),
              const SizedBox(height: 32),

              // 4. APPLICATION SETTINGS
              _buildSectionHeader("APPLICATION SETTINGS"),
              const SizedBox(height: 12),
              _buildInfoContainer([
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(
                          themeProvider.isDark ? Icons.dark_mode_rounded : Icons.light_mode_rounded,
                          color: const Color(0xFF818CF8),
                          size: 20,
                        ),
                        const SizedBox(width: 12),
                        Text(
                          themeProvider.isDark ? "DARK THEME ACTIVE" : "LIGHT THEME ACTIVE",
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    Switch(
                      value: themeProvider.isDark,
                      onChanged: (val) => themeProvider.toggleTheme(),
                      activeColor: const Color(0xFF818CF8),
                      activeTrackColor: const Color(0xFF818CF8).withOpacity(0.3),
                    ),
                  ],
                ),
              ]),
              const SizedBox(height: 32),

              // 5. SALARY STRUCTURE SECTION
              if (employee != null) ...[
                _buildSectionHeader("SALARY STRUCTURE (MONTHLY)"),
                const SizedBox(height: 12),
                _buildInfoContainer([
                  _buildInfoRow("Basic Salary", "₹${employee.basicSalary.toStringAsFixed(0)}"),
                  _buildInfoRow("HRA (House Rent Allow.)", "₹${employee.hra.toStringAsFixed(0)}"),
                  _buildInfoRow("Monthly Bonus", "₹${employee.bonus.toStringAsFixed(0)}"),
                  const Divider(color: Colors.white10),
                  _buildInfoRow(
                    "Gross Salary", 
                    "₹${employee.grossSalary.toStringAsFixed(0)}", 
                    isBold: true,
                    highlightColor: Colors.greenAccent,
                  ),
                  _buildInfoRow("Provident Fund (PF)", "₹${employee.pfAmount.toStringAsFixed(0)}"),
                  _buildInfoRow("ESIC Deduction", "₹${employee.esicAmount.toStringAsFixed(0)}"),
                  const Divider(color: Colors.white10),
                  _buildInfoRow(
                    "Net Take-Home Pay", 
                    "₹${employee.netPay.toStringAsFixed(0)}", 
                    isBold: true,
                    highlightColor: const Color(0xFF818CF8),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: () => PayslipShareService.sharePayslip(employee),
                    icon: const Icon(Icons.share_rounded, size: 16, color: Colors.white),
                    label: const Text(
                      "SHARE OFFICIAL PAYSLIP",
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        letterSpacing: 0.5,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6366F1),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                ]),
                const SizedBox(height: 32),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String label) {
    return Text(
      label,
      style: TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w900,
        color: Colors.white.withOpacity(0.4),
        letterSpacing: 2.0,
      ),
    );
  }

  Widget _buildInfoContainer(List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.02),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      ),
    );
  }

  Widget _buildInfoRow(
    String label, 
    String value, {
    bool isBold = false,
    Color? highlightColor,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
              color: Colors.white.withOpacity(isBold ? 0.8 : 0.4),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isBold ? FontWeight.w900 : FontWeight.bold,
                color: highlightColor ?? Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

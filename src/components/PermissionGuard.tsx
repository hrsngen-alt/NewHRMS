import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";

interface PermissionGuardProps {
  allowedRoles?: ("admin" | "manager" | "employee")[];
  module?: string;
  action?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGuard({ allowedRoles, module, action, children, fallback = null }: PermissionGuardProps) {
  const { role } = useAuth();
  const { hasPermission } = usePermissions();

  // If dynamic permission check is requested
  if (module && action) {
    if (hasPermission(module, action)) {
      return <>{children}</>;
    }
  }

  // Otherwise, fall back to legacy role check
  if (allowedRoles && role && allowedRoles.includes(role)) {
    return <>{children}</>;
  }

  // If neither check was successful
  return <>{fallback}</>;
}

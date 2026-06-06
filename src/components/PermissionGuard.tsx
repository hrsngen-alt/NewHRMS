import React from "react";
import { useAuth } from "@/hooks/useAuth";

interface PermissionGuardProps {
  allowedRoles: ("admin" | "manager" | "employee")[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGuard({ allowedRoles, children, fallback = null }: PermissionGuardProps) {
  const { role } = useAuth();

  if (!role || !allowedRoles.includes(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

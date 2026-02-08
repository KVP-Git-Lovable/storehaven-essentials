import { useMemo } from "react";
import { useAuth } from "./useAuth";

export type AttendanceRole = "employee" | "manager";

/**
 * Determines the user's role for Attendance module visibility.
 * - Employees: See only Live Attendance, Leave Management (own), Leave Balances (own)
 * - Managers/Admins: See all Attendance sections including approvals, regularization, etc.
 */
export function useAttendanceRole() {
  const { profile, isAdmin } = useAuth();

  const attendanceRole = useMemo<AttendanceRole>(() => {
    // Admins are always managers
    if (isAdmin) return "manager";

    const roleName = profile?.role_name?.toLowerCase() || "";

    // Store Manager, Area Manager, Regional Manager, etc. are all managers
    if (
      roleName.includes("manager") ||
      roleName.includes("admin") ||
      roleName.includes("supervisor") ||
      roleName.includes("head") ||
      roleName.includes("lead")
    ) {
      return "manager";
    }

    // Default to employee
    return "employee";
  }, [profile?.role_name, isAdmin]);

  const isManager = attendanceRole === "manager";
  const isEmployee = attendanceRole === "employee";

  // Define which menu items are visible for each role
  const visibleAttendanceMenus = useMemo(() => {
    if (isManager) {
      return [
        "staff.employees",       // Employees
        "staff.recruitment",     // Recruitment
        "staff.feedback",        // Employee Feedback
        "staff.attendance",      // Live Attendance
        "staff.leave",           // Leave Management (with approvals)
        "staff.regularization",  // Regularization
        "staff.leave-balances",  // Leave Balances (all)
        "staff.holidays",        // Holidays
        "staff.working-days",    // Working Days
        "staff.policy",          // Attendance Policy
      ];
    }

    // Employees see limited menu
    return [
      "staff.employees",       // Employees (own profile)
      "staff.feedback",        // Employee Feedback
      "staff.attendance",      // Live Attendance
      "staff.leave",           // Leave Management (own only)
      "staff.leave-balances",  // Leave Balances (own only)
    ];
  }, [isManager]);

  return {
    attendanceRole,
    isManager,
    isEmployee,
    visibleAttendanceMenus,
  };
}

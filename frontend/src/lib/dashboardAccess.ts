import { supabase } from "@/lib/supabase";
import { getSessionWithTimeout, withTimeout } from "@/lib/supabaseAuth";

export type DashboardAccess = {
  userId: string;
  email: string | null;
  role: string;
  isAdmin: boolean;
  managedFairIds: string[];
  canOpenDashboard: boolean;
};

type ProfileResponse = {
  role?: string | null;
  email?: string | null;
};

type EventManagerRow = {
  event_id: string;
};

export async function getDashboardAccess(): Promise<DashboardAccess | null> {
  const { data: { session } } = await getSessionWithTimeout("Dashboard access session check");
  const user = session?.user;

  if (!user) return null;

  const [{ data: profile, error: profileError }, { data: assignments, error: assignmentsError }] = await Promise.all([
    withTimeout(
      supabase
        .from("profiles")
        .select("role,email")
        .eq("id", user.id)
        .maybeSingle(),
      "Dashboard profile access check"
    ),
    withTimeout(
      supabase
        .from("event_managers")
        .select("event_id")
        .eq("user_id", user.id),
      "Dashboard fair assignment check"
    ),
  ]);

  if (profileError) throw profileError;
  if (assignmentsError) throw assignmentsError;

  const normalizedProfile = profile as ProfileResponse | null;
  const normalizedAssignments = (assignments || []) as EventManagerRow[];
  const role = normalizedProfile?.role || "participant";
  const isAdmin = role === "admin";
  const managedFairIds = normalizedAssignments.map((assignment) => assignment.event_id);

  return {
    userId: user.id,
    email: normalizedProfile?.email || user.email || null,
    role,
    isAdmin,
    managedFairIds,
    canOpenDashboard: isAdmin || managedFairIds.length > 0,
  };
}

export async function canManageFair(fairId: string): Promise<boolean> {
  const access = await getDashboardAccess();
  if (!access) return false;
  if (access.isAdmin) return true;

  return access.managedFairIds.includes(fairId);
}

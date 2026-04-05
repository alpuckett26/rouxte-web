"use client";

import { useEffect, useState } from "react";
import { UserRole } from "@/lib/types";

export interface ProfileData {
  user_id: string;
  email?: string;
  role: UserRole;
  full_name: string | null;
  org_id: string | null;
  team_id: string | null;
}

let cache: ProfileData | null = null;

export function useProfile() {
  const [profile, setProfile] = useState<ProfileData | null>(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        cache = d;
        setProfile(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { profile, loading };
}

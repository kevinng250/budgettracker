import { useCallback, useEffect, useState } from "react";
import api from "../api/client";
import type { Profile } from "../types";

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    const res = await api.get("/profiles");
    setProfiles(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  return { profiles, loading, refetch: fetchProfiles };
}

import { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import type { Label } from "../types";

export function useLabels(profileId?: number | null) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLabels = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (profileId != null) params.profile_id = String(profileId);
    const res = await api.get("/labels", { params });
    setLabels(res.data);
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  return { labels, loading, refetch: fetchLabels };
}

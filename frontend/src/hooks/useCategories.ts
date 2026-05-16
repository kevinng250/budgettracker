import { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import type { Category } from "../types";

export function useCategories(includeTags = false) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (includeTags) params.include_tags = "1";
    const res = await api.get("/categories", { params });
    setCategories(res.data);
    setLoading(false);
  }, [includeTags]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { categories, loading, refetch: fetchCategories };
}

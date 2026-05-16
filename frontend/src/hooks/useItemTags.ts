import { useCallback, useEffect, useState } from "react";
import api from "../api/client";
import type { ItemTag } from "../types";

export function useItemTags() {
  const [itemTags, setItemTags] = useState<ItemTag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItemTags = useCallback(async () => {
    setLoading(true);
    const res = await api.get("/item-tags");
    setItemTags(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItemTags();
  }, [fetchItemTags]);

  return { itemTags, loading, refetch: fetchItemTags };
}

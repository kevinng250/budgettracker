import { Title, Stack, Text } from "@mantine/core";
import TagsDirectory from "../components/TagsDirectory";
import { useTags } from "../hooks/useTags";
import { useCategories } from "../hooks/useCategories";

export default function TagsPage() {
  const { tags, loading: tagsLoading, refetch: refetchTags } = useTags();
  const { categories, loading: categoriesLoading, refetch: refetchCategories } = useCategories();

  const refetchAll = () => {
    refetchCategories();
    refetchTags();
  };

  const isInitialLoad =
    (categoriesLoading && categories.length === 0) ||
    (tagsLoading && tags.length === 0);

  return (
    <Stack>
      <Title order={2}>Tags & Categories</Title>
      {isInitialLoad ? (
        <Text>Loading...</Text>
      ) : (
        <TagsDirectory tags={tags} categories={categories} onRefresh={refetchAll} />
      )}
    </Stack>
  );
}

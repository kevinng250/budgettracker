import { Title, Paper } from "@mantine/core";
import TagManager from "../components/TagManager";
import { useTags } from "../hooks/useTags";

export default function TagsPage() {
  const { tags, loading, refetch } = useTags();

  return (
    <>
      <Title order={2} mb="md">
        Tags
      </Title>
      <Paper p="md" withBorder>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <TagManager tags={tags} onRefresh={refetch} />
        )}
      </Paper>
    </>
  );
}

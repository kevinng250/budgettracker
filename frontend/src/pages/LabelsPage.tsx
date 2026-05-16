import { useState } from "react";
import {
  Title,
  Stack,
  Card,
  Text,
  Group,
  Badge,
  SimpleGrid,
  Affix,
  ActionIcon,
  UnstyledButton,
} from "@mantine/core";
import { IconBookmark, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useLabels } from "../hooks/useLabels";
import AddLabelModal from "../components/AddLabelModal";

export default function LabelsPage() {
  const { labels, loading, refetch } = useLabels();
  const [addOpen, setAddOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <Stack>
      <Title order={2}>Labels</Title>
      <Text size="sm" c="dimmed">
        Tag transactions with labels (e.g. trips, projects) to track spend across them.
      </Text>

      {loading && labels.length === 0 ? (
        <Text>Loading...</Text>
      ) : labels.length === 0 ? (
        <Card withBorder p="xl">
          <Stack align="center" gap="xs">
            <IconBookmark size={28} />
            <Text fw={500}>No labels yet</Text>
            <Text size="sm" c="dimmed">
              Click the + button to create your first label.
            </Text>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
          {labels.map((label) => (
            <UnstyledButton
              key={label.id}
              onClick={() => navigate(`/labels/${label.id}`)}
            >
              <Card withBorder padding="md" className="label-card">
                <Group justify="space-between" mb="xs">
                  <Group gap="xs">
                    <IconBookmark size={16} />
                    <Text fw={600}>{label.name}</Text>
                  </Group>
                  <Badge variant="light" size="sm">
                    {label.transaction_count ?? 0}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">Total spent</Text>
                <Text fw={700} size="lg">
                  ${(label.total_spent ?? 0).toFixed(2)}
                </Text>
              </Card>
            </UnstyledButton>
          ))}
        </SimpleGrid>
      )}

      <Affix position={{ bottom: 24, right: 24 }}>
        <ActionIcon
          size={56}
          radius="xl"
          variant="filled"
          color="blue"
          aria-label="New label"
          onClick={() => setAddOpen(true)}
        >
          <IconPlus size={26} />
        </ActionIcon>
      </Affix>

      <AddLabelModal
        opened={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={refetch}
      />
    </Stack>
  );
}

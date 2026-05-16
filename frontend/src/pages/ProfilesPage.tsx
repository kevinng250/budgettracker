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
  Box,
} from "@mantine/core";
import { IconPlus, IconUsers } from "@tabler/icons-react";
import { useProfiles } from "../hooks/useProfiles";
import AddProfileModal from "../components/AddProfileModal";
import ProfileEditModal from "../components/ProfileEditModal";
import type { Profile } from "../types";

function ColorDot({ color }: { color: string | null }) {
  return (
    <Box
      style={{
        width: 14,
        height: 14,
        borderRadius: "50%",
        backgroundColor: color ?? "var(--mantine-color-gray-4)",
        display: "inline-block",
      }}
    />
  );
}

export default function ProfilesPage() {
  const { profiles, loading, refetch } = useProfiles();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);

  return (
    <Stack>
      <Title order={2}>Profiles</Title>
      <Text size="sm" c="dimmed">
        Each profile owns its own transactions, manual accounts, pending receipts,
        and upload history. Tags, categories, and labels are shared across the
        household. Switch profiles from the header dropdown; pick <strong>Combined</strong> to see the household total.
      </Text>

      {loading && profiles.length === 0 ? (
        <Text>Loading…</Text>
      ) : profiles.length === 0 ? (
        <Card withBorder p="xl">
          <Stack align="center" gap="xs">
            <IconUsers size={32} stroke={1.5} />
            <Text fw={500}>No profiles yet</Text>
            <Text size="sm" c="dimmed">Click + to create the first one.</Text>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" style={{ alignItems: "start" }}>
          {profiles.map((p) => (
            <UnstyledButton key={p.id} onClick={() => setEditing(p)}>
              <Card withBorder padding="md" radius="md">
                <Group justify="space-between" mb="xs" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                    <ColorDot color={p.color} />
                    <Text fw={600} truncate>{p.name}</Text>
                  </Group>
                  {p.is_default ? (
                    <Badge size="xs" variant="light" color="blue">Default</Badge>
                  ) : null}
                </Group>
                {p.counts && (
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">
                      {p.counts.transactions} transactions ·{" "}
                      {p.counts.manual_accounts} accounts
                    </Text>
                    <Text size="xs" c="dimmed">
                      {p.counts.pending_receipts} pending ·{" "}
                      {p.counts.upload_log} uploads
                    </Text>
                  </Stack>
                )}
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
          aria-label="New profile"
          onClick={() => setAddOpen(true)}
        >
          <IconPlus size={26} />
        </ActionIcon>
      </Affix>

      <AddProfileModal
        opened={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={refetch}
      />
      <ProfileEditModal
        profile={editing}
        onClose={() => setEditing(null)}
        onSaved={refetch}
      />
    </Stack>
  );
}

import { useEffect, useState } from "react";
import {
  Title,
  Stack,
  Card,
  SimpleGrid,
  Text,
  Group,
  Badge,
  ActionIcon,
  UnstyledButton,
  Anchor,
} from "@mantine/core";
import { IconTrash, IconCamera, IconAlertTriangle } from "@tabler/icons-react";
import { Link, useNavigate } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import api from "../api/client";
import type { PendingReceiptSummary } from "../types";

function relativeTime(iso: string): string {
  // SQLite datetime('now') returns UTC without TZ info; treat as UTC.
  const stamp = iso.includes("T") ? iso : iso.replace(" ", "T") + "Z";
  const ms = Date.now() - new Date(stamp).getTime();
  if (!Number.isFinite(ms) || ms < 0) return iso;
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function ReceiptQueuePage() {
  const [pending, setPending] = useState<PendingReceiptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchPending = async () => {
    try {
      const res = await api.get<PendingReceiptSummary[]>("/pending-receipts");
      setPending(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleDiscard = async (id: number) => {
    if (!window.confirm("Discard this pending receipt?")) return;
    try {
      await api.delete(`/pending-receipts/${id}`);
      setPending((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.error || "Failed to discard",
        color: "red",
      });
    }
  };

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap">
        <Title order={2}>Review Queue</Title>
        <Anchor component={Link} to="/receipts" size="sm">
          + Scan another receipt
        </Anchor>
      </Group>

      {loading ? (
        <Text c="dimmed">Loading…</Text>
      ) : pending.length === 0 ? (
        <Card withBorder p="xl">
          <Stack align="center" gap="xs">
            <IconCamera size={32} stroke={1.5} />
            <Text fw={500}>No pending receipts</Text>
            <Text size="sm" c="dimmed">
              Snap one on your phone from <strong>/receipts</strong> — it'll
              appear here for review.
            </Text>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" style={{ alignItems: "start" }}>
          {pending.map((p) => (
            <Card key={p.id} withBorder padding="md" radius="md">
              <Group justify="space-between" wrap="nowrap" mb="xs">
                <UnstyledButton
                  onClick={() => navigate(`/receipts/queue/${p.id}`)}
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <Text fw={600} size="md" truncate>
                    {p.merchant || "Unknown merchant"}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {p.purchase_date || "no date"} · {relativeTime(p.created_at)}
                  </Text>
                </UnstyledButton>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDiscard(p.id);
                  }}
                  aria-label="Discard"
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>

              <UnstyledButton
                onClick={() => navigate(`/receipts/queue/${p.id}`)}
                style={{ width: "100%" }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Text fw={700} size="xl">
                    {p.total != null ? `$${p.total.toFixed(2)}` : "—"}
                  </Text>
                  {p.warnings_count > 0 && (
                    <Badge
                      color="yellow"
                      variant="light"
                      leftSection={<IconAlertTriangle size={12} />}
                    >
                      {p.warnings_count} {p.warnings_count === 1 ? "warning" : "warnings"}
                    </Badge>
                  )}
                </Group>
              </UnstyledButton>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}

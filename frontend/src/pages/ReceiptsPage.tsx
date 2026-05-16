import { useEffect, useState } from "react";
import {
  Title,
  Stack,
  Paper,
  Group,
  Button,
  Text,
  Loader,
  Anchor,
} from "@mantine/core";
import { IconCamera, IconUpload, IconCheck } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useActiveProfile } from "../context/ActiveProfile";
import type { ReceiptUploadResponse, PendingReceiptSummary } from "../types";

export default function ReceiptsPage() {
  const [busy, setBusy] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [lastQueuedId, setLastQueuedId] = useState<number | null>(null);
  const { activeProfileId } = useActiveProfile();

  const fetchPendingCount = async () => {
    try {
      const res = await api.get<PendingReceiptSummary[]>("/pending-receipts");
      setPendingCount(res.data.length);
    } catch {
      // Non-fatal — the upload screen still works even if the count fails.
    }
  };

  useEffect(() => {
    fetchPendingCount();
  }, []);

  const handleFileSelected = async (file: File) => {
    if (activeProfileId == null) {
      notifications.show({
        title: "Pick a profile first",
        message: "Switch from Combined to a specific profile in the header before scanning.",
        color: "yellow",
      });
      return;
    }
    setBusy(true);
    setLastQueuedId(null);
    const form = new FormData();
    form.append("file", file);
    form.append("profile_id", String(activeProfileId));
    try {
      const res = await api.post<ReceiptUploadResponse>(
        "/receipts/upload",
        form
      );
      setLastQueuedId(res.data.pending_id);
      notifications.show({
        title: "Queued for review",
        message: "Open the review queue on your Mac to confirm and save.",
        color: "green",
      });
      fetchPendingCount();
    } catch (err: any) {
      notifications.show({
        title: "Upload failed",
        message: err.response?.data?.error || "Failed to upload receipt",
        color: "red",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap">
        <Title order={2}>Scan Receipt</Title>
        {pendingCount != null && pendingCount > 0 && (
          <Anchor component={Link} to="/receipts/queue" size="sm">
            Review {pendingCount} pending →
          </Anchor>
        )}
      </Group>
      {activeProfileId == null && (
        <Paper p="sm" withBorder bg="var(--mantine-color-yellow-0)">
          <Text size="sm">
            You're in <strong>Combined</strong> view. Pick a profile in the header before scanning so the receipt is recorded for the right person.
          </Text>
        </Paper>
      )}
      <Text size="sm" c="dimmed">
        Snap a receipt; we'll parse line items in the background and add it to
        the review queue. Open the queue on your Mac when you're ready to
        confirm and save.
      </Text>

      <Paper p="xl" withBorder style={{ textAlign: "center" }}>
        <Stack align="center" gap="md">
          <IconCamera size={48} stroke={1.5} />
          <Text fw={500}>Take or choose a photo</Text>
          <Group gap="sm">
            <Button
              component="label"
              leftSection={<IconCamera size={16} />}
              loading={busy}
            >
              Open Camera
              <input
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelected(f);
                  e.target.value = ""; // allow re-selecting same file
                }}
              />
            </Button>
            <Button
              component="label"
              variant="default"
              leftSection={<IconUpload size={16} />}
              loading={busy}
            >
              Choose Photo
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelected(f);
                  e.target.value = "";
                }}
              />
            </Button>
          </Group>
          {busy && (
            <Group gap="xs">
              <Loader size="xs" />
              <Text size="sm" c="dimmed">Parsing receipt…</Text>
            </Group>
          )}
        </Stack>
      </Paper>

      {lastQueuedId != null && !busy && (
        <Paper p="md" withBorder bg="var(--mantine-color-green-0)">
          <Group justify="space-between" wrap="wrap">
            <Group gap="xs">
              <IconCheck size={18} />
              <Text size="sm">Queued! Snap another or review on your Mac.</Text>
            </Group>
            <Anchor component={Link} to={`/receipts/queue/${lastQueuedId}`} size="sm">
              Review this one →
            </Anchor>
          </Group>
        </Paper>
      )}
    </Stack>
  );
}

import { useEffect, useState } from "react";
import {
  Title,
  Stack,
  Paper,
  Group,
  Button,
  Text,
  TextInput,
  NumberInput,
  Table,
  Alert,
  Select,
  ActionIcon,
  Badge,
  SegmentedControl,
  Loader,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconTrash,
  IconPlus,
  IconArrowLeft,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/client";
import { useTags } from "../hooks/useTags";
import { useActiveProfile } from "../context/ActiveProfile";
import type {
  ExtractedReceipt,
  ReceiptLineItem,
  PendingReceiptDetail,
  MatchCandidate,
} from "../types";

export default function ReceiptReviewPage() {
  const { id } = useParams<{ id: string }>();
  const pendingId = id ? Number(id) : null;
  const navigate = useNavigate();
  const { tags } = useTags();
  const { activeProfileId } = useActiveProfile();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<ExtractedReceipt | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [storedPath, setStoredPath] = useState<string | null>(null);
  const [targetKind, setTargetKind] = useState<"link" | "create">("create");
  const [targetTxnId, setTargetTxnId] = useState<string>("");

  const tagOptions = [
    { value: "", label: "Select tag…" },
    ...tags.map((t) => ({ value: t.name, label: t.name })),
  ];

  useEffect(() => {
    if (pendingId == null) return;
    (async () => {
      try {
        const res = await api.get<PendingReceiptDetail>(`/pending-receipts/${pendingId}`);
        const { extracted, warnings, match_suggestion, stored_path } = res.data;
        extracted.line_items = (extracted.line_items || []).map((it) => ({
          ...it,
          tag: it.tag ?? it.suggested_tag ?? "other",
        }));
        setReceipt(extracted);
        setWarnings(warnings);
        setStoredPath(stored_path);
        const cands = match_suggestion?.candidates ?? [];
        setCandidates(cands);
        if (cands.length === 1 && match_suggestion?.confidence === "high") {
          setTargetKind("link");
          setTargetTxnId(String(cands[0].id));
        }
      } catch (err: any) {
        notifications.show({
          title: "Couldn't load receipt",
          message: err.response?.data?.error || "Not found",
          color: "red",
        });
        navigate("/receipts/queue");
      } finally {
        setLoading(false);
      }
    })();
  }, [pendingId, navigate]);

  const updateField = <K extends keyof ExtractedReceipt>(
    key: K,
    value: ExtractedReceipt[K]
  ) => {
    setReceipt((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateItem = (index: number, patch: Partial<ReceiptLineItem>) => {
    setReceipt((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        line_items: prev.line_items.map((it, i) =>
          i === index ? { ...it, ...patch } : it
        ),
      };
    });
  };

  const addItem = () => {
    setReceipt((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        line_items: [
          ...prev.line_items,
          { description: "", line_total: 0, tag: "other" },
        ],
      };
    });
  };

  const removeItem = (index: number) => {
    setReceipt((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        line_items: prev.line_items.filter((_, i) => i !== index),
      };
    });
  };

  const itemsSum = receipt
    ? Math.round(
        receipt.line_items.reduce((s, it) => s + (Number(it.line_total) || 0), 0) *
          100
      ) / 100
    : 0;
  const totalDelta = receipt ? Math.round((receipt.total - itemsSum) * 100) / 100 : 0;
  const canSave =
    !!receipt &&
    receipt.line_items.length > 0 &&
    receipt.line_items.every((it) => it.description && it.tag) &&
    Math.abs(totalDelta) < 0.01 &&
    (targetKind === "create" || (targetKind === "link" && targetTxnId));

  const handleSave = async () => {
    if (!receipt || pendingId == null) return;
    setBusy(true);
    try {
      const body: Record<string, any> = {
        extracted: receipt,
        stored_path: storedPath,
        pending_id: pendingId,
        target:
          targetKind === "link"
            ? { kind: "link", transaction_id: Number(targetTxnId) }
            : { kind: "create" },
      };
      // For create mode, fall back to the active profile if the pending row
      // didn't carry one (shouldn't normally happen — pendings always have one).
      if (targetKind === "create" && activeProfileId != null) {
        body.profile_id = activeProfileId;
      }
      const res = await api.post<{ parent_id: number; linked: boolean }>(
        "/receipts/save",
        body
      );
      notifications.show({
        title: "Receipt saved",
        message: "Add per-unit prices and grocery tags on the Items page.",
        color: "green",
      });
      navigate(`/items?transaction_id=${res.data.parent_id}`);
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.error || "Failed to save receipt",
        color: "red",
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading || !receipt) {
    return (
      <Stack>
        <Group gap="xs">
          <ActionIcon variant="subtle" onClick={() => navigate("/receipts/queue")}>
            <IconArrowLeft size={18} />
          </ActionIcon>
          <Title order={2}>Loading…</Title>
        </Group>
        {loading && <Loader size="sm" />}
      </Stack>
    );
  }

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap">
        <Group gap="xs">
          <ActionIcon variant="subtle" onClick={() => navigate("/receipts/queue")}>
            <IconArrowLeft size={18} />
          </ActionIcon>
          <Title order={2}>Review Receipt</Title>
        </Group>
        <Badge variant="light" size="lg" color={Math.abs(totalDelta) < 0.01 ? "green" : "red"}>
          Δ ${totalDelta.toFixed(2)}
        </Badge>
      </Group>

      {warnings.length > 0 && (
        <Alert color="yellow" icon={<IconAlertTriangle size={16} />}>
          <Stack gap={4}>
            {warnings.map((w, i) => (
              <Text key={i} size="sm">{w}</Text>
            ))}
          </Stack>
        </Alert>
      )}

      <Paper p="md" withBorder>
        <Group grow>
          <TextInput
            label="Merchant"
            value={receipt.merchant ?? ""}
            onChange={(e) => updateField("merchant", e.currentTarget.value)}
          />
          <TextInput
            label="Date"
            placeholder="YYYY-MM-DD"
            value={receipt.purchase_date ?? ""}
            onChange={(e) => updateField("purchase_date", e.currentTarget.value)}
          />
          <NumberInput
            label="Subtotal"
            value={receipt.subtotal ?? ""}
            onChange={(v) => updateField("subtotal", typeof v === "number" ? v : undefined)}
            prefix="$"
            decimalScale={2}
          />
          <NumberInput
            label="Tax"
            value={receipt.tax ?? ""}
            onChange={(v) => updateField("tax", typeof v === "number" ? v : undefined)}
            prefix="$"
            decimalScale={2}
          />
          <NumberInput
            label="Total"
            value={receipt.total}
            onChange={(v) => updateField("total", typeof v === "number" ? v : 0)}
            prefix="$"
            decimalScale={2}
            required
          />
        </Group>
      </Paper>

      <Paper p="md" withBorder>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Line items</Text>
          <Text size="xs" c="dimmed">
            Sum: ${itemsSum.toFixed(2)} / Total: ${receipt.total.toFixed(2)}
          </Text>
        </Group>
        <Table.ScrollContainer minWidth={520}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Description</Table.Th>
                <Table.Th style={{ width: 110 }}>Amount</Table.Th>
                <Table.Th style={{ width: 160 }}>Tag</Table.Th>
                <Table.Th style={{ width: 40 }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {receipt.line_items.map((it, i) => (
                <Table.Tr key={i}>
                  <Table.Td>
                    <TextInput
                      size="xs"
                      value={it.description}
                      onChange={(e) =>
                        updateItem(i, { description: e.currentTarget.value })
                      }
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      value={it.line_total}
                      onChange={(v) =>
                        updateItem(i, {
                          line_total: typeof v === "number" ? v : Number(v) || 0,
                        })
                      }
                      prefix="$"
                      decimalScale={2}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Select
                      size="xs"
                      data={tagOptions}
                      value={it.tag ?? ""}
                      onChange={(v) => updateItem(i, { tag: v ?? "" })}
                      allowDeselect={false}
                      searchable
                    />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={() => removeItem(i)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        <Group mt="sm">
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={addItem}
          >
            Add line item
          </Button>
        </Group>
      </Paper>

      <Paper p="md" withBorder>
        <Stack gap="sm">
          <Text fw={600}>Where should this receipt land?</Text>
          <SegmentedControl
            value={targetKind}
            onChange={(v) => setTargetKind(v as "link" | "create")}
            data={[
              { label: "Link to existing transaction", value: "link" },
              { label: "Create new transaction", value: "create" },
            ]}
          />
          {targetKind === "link" ? (
            candidates.length === 0 ? (
              <Text size="sm" c="dimmed">
                No matching transactions found within ±$0.05 / ±2 days. Try
                "Create new transaction" instead.
              </Text>
            ) : (
              <Select
                label="Target transaction"
                data={candidates.map((c) => ({
                  value: String(c.id),
                  label: `${c.date} — ${c.bank}/${c.account} — $${c.amount.toFixed(2)} — ${c.description}`,
                }))}
                value={targetTxnId}
                onChange={(v) => setTargetTxnId(v ?? "")}
                allowDeselect={false}
              />
            )
          ) : (
            <Text size="sm" c="dimmed">
              A new parent transaction will be created with bank "Receipt",
              account = merchant, and line items recorded as splits.
            </Text>
          )}
        </Stack>
      </Paper>

      <Group justify="flex-end">
        <Button variant="default" onClick={() => navigate("/receipts/queue")}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!canSave} loading={busy}>
          Save receipt
        </Button>
      </Group>
    </Stack>
  );
}

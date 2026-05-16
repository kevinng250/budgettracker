import { useEffect, useState } from "react";
import {
  Title,
  Stack,
  Group,
  Paper,
  TextInput,
  Select,
  Table,
  Text,
  Badge,
  ActionIcon,
  UnstyledButton,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconSearch, IconTrash, IconEdit, IconX } from "@tabler/icons-react";
import { useSearchParams } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import api from "../api/client";
import { useItemTags } from "../hooks/useItemTags";
import { useActiveProfile } from "../context/ActiveProfile";
import ItemEditModal from "../components/ItemEditModal";
import type { ReceiptItem } from "../types";

function formatDate(d: Date | null): string | undefined {
  if (!d) return undefined;
  return d.toISOString().slice(0, 10);
}

export default function ItemsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTxnId = searchParams.get("transaction_id");

  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [editing, setEditing] = useState<ReceiptItem | null>(null);

  const { itemTags, refetch: refetchTags } = useItemTags();
  const { activeProfileId } = useActiveProfile();

  const fetchItems = async () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (filterTag) params.item_tag = filterTag;
    if (dateFrom) params.date_from = formatDate(dateFrom)!;
    if (dateTo) params.date_to = formatDate(dateTo)!;
    if (initialTxnId) params.transaction_id = initialTxnId;
    if (activeProfileId != null) params.profile_id = String(activeProfileId);
    const res = await api.get("/items", { params });
    setItems(res.data);
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterTag, dateFrom, dateTo, initialTxnId, activeProfileId]);

  const clearTransactionFilter = () => {
    searchParams.delete("transaction_id");
    setSearchParams(searchParams);
  };

  const handleSaved = () => {
    refetchTags();
    fetchItems();
  };

  const handleDelete = async (item: ReceiptItem) => {
    if (!window.confirm(`Delete item "${item.description}"?`)) return;
    try {
      await api.delete(`/items/${item.id}`);
      fetchItems();
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.error || "Failed to delete item",
        color: "red",
      });
    }
  };

  const tagFilterOptions = [
    { value: "", label: "All tags" },
    ...itemTags.map((t) => ({
      value: t.name,
      label: `${t.name} (${t.usage_count ?? 0})`,
    })),
  ];

  return (
    <Stack>
      <style>{`
        .item-row:hover {
          background-color: var(--mantine-color-gray-1);
        }
      `}</style>
      <Text size="sm" c="dimmed">
        Click an item to set its grocery tag (e.g. <em>bananas</em>, <em>eggs</em>),
        per-unit price, quantity, and notes. Grocery tags are separate from the
        transaction tags used for budgeting.
      </Text>
      <Group justify="space-between">
        <Title order={2}>Receipt Items</Title>
        {initialTxnId && (
          <Badge
            variant="filled"
            color="blue"
            size="lg"
            rightSection={
              <ActionIcon
                size="xs"
                variant="transparent"
                color="white"
                onClick={clearTransactionFilter}
              >
                <IconX size={14} />
              </ActionIcon>
            }
          >
            Filtered to receipt #{initialTxnId} — click × to see all items
          </Badge>
        )}
      </Group>

      <Paper p="md" withBorder>
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search description..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            leftSection={<IconSearch size={14} />}
            size="sm"
            w={220}
          />
          <Select
            placeholder="Grocery tag"
            value={filterTag}
            onChange={(v) => setFilterTag(v ?? "")}
            data={tagFilterOptions}
            size="sm"
            w={200}
            allowDeselect={false}
            searchable
          />
          <DatePickerInput
            placeholder="From"
            value={dateFrom}
            onChange={setDateFrom}
            clearable
            size="sm"
            w={140}
          />
          <DatePickerInput
            placeholder="To"
            value={dateTo}
            onChange={setDateTo}
            clearable
            size="sm"
            w={140}
          />
        </Group>
      </Paper>

      <Paper p="md" withBorder>
        {items.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            No items found. Save a receipt to start populating items.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={820}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Merchant</Table.Th>
                <Table.Th>Item</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Total</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Qty</Table.Th>
                <Table.Th>Unit</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>$/unit</Table.Th>
                <Table.Th>Tags</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((it) => (
                <Table.Tr key={it.id}>
                  <Table.Td>
                    <Text size="sm">{it.transaction_date}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">{it.merchant}</Text>
                  </Table.Td>
                  <Table.Td style={{ maxWidth: 250 }}>
                    <UnstyledButton
                      onClick={() => setEditing(it)}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "4px 8px",
                        borderRadius: 4,
                      }}
                      className="item-row"
                    >
                      <Text size="sm" fw={500} c="blue">
                        {it.description}
                      </Text>
                    </UnstyledButton>
                  </Table.Td>
                  <Table.Td style={{ textAlign: "right" }}>
                    <Text size="sm">${it.line_total.toFixed(2)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: "right" }}>
                    <Text size="sm">{it.quantity ?? "—"}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{it.unit ?? "—"}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: "right" }}>
                    <Text size="sm">
                      {it.unit_price != null ? `$${it.unit_price.toFixed(2)}` : "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="wrap">
                      {it.item_tags.map((t) => (
                        <Badge key={t} size="xs" variant="light" color="teal">
                          {t}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        title="Edit item"
                        onClick={() => setEditing(it)}
                      >
                        <IconEdit size={14} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        title="Delete item"
                        onClick={() => handleDelete(it)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <ItemEditModal
        item={editing}
        itemTags={itemTags}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />
    </Stack>
  );
}

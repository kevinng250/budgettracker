import { useEffect, useState } from "react";
import {
  Popover,
  Stack,
  Checkbox,
  TextInput,
  Text,
  Group,
  Divider,
  ActionIcon,
} from "@mantine/core";
import { IconPlus, IconTags, IconTagsFilled } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import api from "../api/client";
import type { Label } from "../types";

interface Props {
  transactionId: number;
  currentLabelIds: number[];
  labels: Label[];
  onSaved: () => void;
}

export default function LabelPicker({
  transactionId,
  currentLabelIds,
  labels,
  onSaved,
}: Props) {
  const [opened, setOpened] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set(currentLabelIds));
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Re-sync local state with parent whenever the popover opens or the underlying ids change.
  useEffect(() => {
    setSelected(new Set(currentLabelIds));
  }, [opened, currentLabelIds]);

  const showError = (err: any, fallback: string) =>
    notifications.show({
      title: "Error",
      message: err.response?.data?.error || fallback,
      color: "red",
    });

  const persist = async (next: Set<number>) => {
    try {
      await api.put(`/transactions/${transactionId}/labels`, {
        label_ids: Array.from(next),
      });
      setDirty(true);
    } catch (err: any) {
      // Revert local state on failure.
      setSelected(new Set(currentLabelIds));
      showError(err, "Failed to update labels");
    }
  };

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next); // optimistic
    persist(next);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await api.post("/labels", { name });
      const newId: number = res.data.id;
      const next = new Set(selected).add(newId);
      setSelected(next);
      setNewName("");
      // Persist assignment for this transaction *and* refresh the parent's
      // labels list so the new label appears on other rows too.
      await persist(next);
      onSaved();
    } catch (err: any) {
      showError(err, "Failed to create label");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpened(next);
    if (!next && dirty) {
      // Closing — let the parent refresh once so other rows see the new state.
      onSaved();
      setDirty(false);
    }
  };

  const hasLabels = currentLabelIds.length > 0;

  return (
    <Popover
      opened={opened}
      onChange={handleOpenChange}
      position="bottom-end"
      withArrow
      shadow="md"
      width={240}
      closeOnClickOutside
      trapFocus
    >
      <Popover.Target>
        <ActionIcon
          variant={hasLabels ? "filled" : "subtle"}
          color={hasLabels ? "blue" : "gray"}
          size="sm"
          onClick={() => handleOpenChange(!opened)}
          title="Labels"
          aria-label="Labels"
        >
          {hasLabels ? <IconTagsFilled size={14} /> : <IconTags size={14} />}
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text size="xs" c="dimmed" fw={500}>
            Labels
          </Text>
          {labels.length === 0 ? (
            <Text size="xs" c="dimmed">No labels yet — create one below.</Text>
          ) : (
            <Stack gap={4}>
              {labels.map((l) => (
                <Checkbox
                  key={l.id}
                  size="xs"
                  label={l.name}
                  checked={selected.has(l.id)}
                  onChange={() => toggle(l.id)}
                />
              ))}
            </Stack>
          )}
          <Divider />
          <Group gap="xs" wrap="nowrap">
            <TextInput
              size="xs"
              placeholder="New label..."
              value={newName}
              onChange={(e) => setNewName(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              style={{ flex: 1 }}
              disabled={creating}
            />
            <ActionIcon
              size="sm"
              variant="light"
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              loading={creating}
            >
              <IconPlus size={14} />
            </ActionIcon>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

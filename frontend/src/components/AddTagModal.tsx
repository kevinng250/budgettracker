import { useEffect, useState } from "react";
import { Modal, Stack, Group, Button, TextInput, Select } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import api from "../api/client";
import type { Category } from "../types";

interface Props {
  opened: boolean;
  categories: Category[];
  defaultCategory?: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function AddTagModal({ opened, categories, defaultCategory, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(defaultCategory ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (opened) {
      setName("");
      setCategory(defaultCategory ?? "");
    }
  }, [opened, defaultCategory]);

  const categoryOptions = [
    { value: "", label: "Uncategorized" },
    ...categories.map((c) => ({ value: c.name, label: c.name })),
  ];

  const handleCreate = async () => {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) return;
    setBusy(true);
    try {
      await api.post("/tags", { name: trimmed, category: category || null });
      onCreated();
      onClose();
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.error || "Failed to create tag",
        color: "red",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="New Tag" centered>
      <Stack>
        <TextInput
          label="Name"
          placeholder="e.g. coffee"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          autoFocus
        />
        <Select
          label="Category"
          data={categoryOptions}
          value={category}
          onChange={(v) => setCategory(v ?? "")}
          allowDeselect={false}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={busy}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

import { useEffect, useState } from "react";
import {
  Modal,
  Stack,
  Group,
  Button,
  TextInput,
  Select,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import api from "../api/client";
import type { Tag, Category } from "../types";

interface Props {
  tag: Tag | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

export default function TagEditModal({ tag, categories, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tag) {
      setName(tag.name);
      setCategory(tag.category ?? "");
    }
  }, [tag]);

  if (!tag) return null;

  const categoryOptions = [
    { value: "", label: "Uncategorized" },
    ...categories.map((c) => ({ value: c.name, label: c.name })),
  ];

  const showError = (err: any, fallback: string) => {
    notifications.show({
      title: "Error",
      message: err.response?.data?.error || fallback,
      color: "red",
    });
  };

  const handleSave = async () => {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) return;
    setBusy(true);
    try {
      const body: Record<string, any> = { category: category || null };
      if (trimmed !== tag.name) body.name = trimmed;
      await api.patch(`/tags/${encodeURIComponent(tag.name)}`, body);
      onSaved();
      onClose();
    } catch (err: any) {
      showError(err, "Failed to update tag");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete tag "${tag.name}"? Any transactions using it will be reassigned to "other".`)) return;
    setBusy(true);
    try {
      await api.delete(`/tags/${encodeURIComponent(tag.name)}`);
      onSaved();
      onClose();
    } catch (err: any) {
      showError(err, "Failed to delete tag");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      opened={!!tag}
      onClose={onClose}
      title={`Edit "${tag.name}"`}
      centered
    >
      <Stack>
        <TextInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          autoFocus
        />
        <Select
          label="Category"
          data={categoryOptions}
          value={category}
          onChange={(v) => setCategory(v ?? "")}
          allowDeselect={false}
        />
        {tag.is_default && (
          <Text size="xs" c="dimmed">
            Default tags can be renamed and recategorized but not deleted.
          </Text>
        )}
        <Group justify="space-between" mt="sm">
          <div>
            {!tag.is_default && (
              <Button color="red" variant="light" onClick={handleDelete} disabled={busy}>
                Delete
              </Button>
            )}
          </div>
          <Group gap="xs">
            <Button variant="default" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={busy}>
              Save
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

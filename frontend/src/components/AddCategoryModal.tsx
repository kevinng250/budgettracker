import { useState } from "react";
import { Modal, Stack, Group, Button, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import api from "../api/client";

interface Props {
  opened: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function AddCategoryModal({ opened, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleClose = () => {
    setName("");
    onClose();
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await api.post("/categories", { name: trimmed });
      onCreated();
      handleClose();
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.error || "Failed to create category",
        color: "red",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="New Category" centered>
      <Stack>
        <TextInput
          label="Name"
          placeholder="e.g. Subscriptions"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          autoFocus
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose} disabled={busy}>
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

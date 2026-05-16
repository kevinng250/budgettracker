import { useEffect, useState } from "react";
import { Modal, Stack, Group, Button, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import api from "../api/client";

interface Props {
  opened: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function AddLabelModal({ opened, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (opened) setName("");
  }, [opened]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await api.post("/labels", { name: trimmed });
      onCreated();
      onClose();
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.error || "Failed to create label",
        color: "red",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="New Label" centered>
      <Stack>
        <TextInput
          label="Name"
          placeholder="e.g. London26"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          autoFocus
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

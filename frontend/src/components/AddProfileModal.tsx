import { useEffect, useState } from "react";
import {
  Modal,
  Stack,
  Group,
  Button,
  TextInput,
  ColorInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import api from "../api/client";

interface Props {
  opened: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function AddProfileModal({ opened, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (opened) {
      setName("");
      setColor("");
    }
  }, [opened]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await api.post("/profiles", { name: trimmed, color: color || null });
      onCreated();
      onClose();
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.error || "Failed to create profile",
        color: "red",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="New Profile" centered>
      <Stack>
        <TextInput
          label="Name"
          placeholder="e.g. Partner"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          autoFocus
          required
        />
        <ColorInput
          label="Color (optional)"
          placeholder="Tap to pick"
          value={color}
          onChange={setColor}
          format="hex"
          swatches={[
            "#4c6ef5", "#12b886", "#fa5252", "#fab005",
            "#7950f2", "#15aabf", "#fd7e14", "#e64980",
          ]}
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

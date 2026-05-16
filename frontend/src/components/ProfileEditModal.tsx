import { useEffect, useState } from "react";
import {
  Modal,
  Stack,
  Group,
  Button,
  TextInput,
  ColorInput,
  Text,
  Badge,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import api from "../api/client";
import type { Profile } from "../types";

interface Props {
  profile: Profile | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function ProfileEditModal({ profile, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setColor(profile.color ?? "");
    }
  }, [profile]);

  if (!profile) return null;

  const totalRows =
    (profile.counts?.transactions ?? 0) +
    (profile.counts?.manual_accounts ?? 0) +
    (profile.counts?.pending_receipts ?? 0) +
    (profile.counts?.upload_log ?? 0);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await api.patch(`/profiles/${profile.id}`, {
        name: trimmed,
        color: color || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.error || "Failed to save profile",
        color: "red",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(
      `Delete profile "${profile.name}"? This is only allowed when no transactional rows reference it.`
    )) return;
    setBusy(true);
    try {
      await api.delete(`/profiles/${profile.id}`);
      onSaved();
      onClose();
    } catch (err: any) {
      notifications.show({
        title: "Cannot delete",
        message: err.response?.data?.error || "Delete failed",
        color: "red",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={!!profile} onClose={onClose} title={`Edit "${profile.name}"`} centered>
      <Stack>
        <TextInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <ColorInput
          label="Color"
          placeholder="Tap to pick"
          value={color}
          onChange={setColor}
          format="hex"
          swatches={[
            "#4c6ef5", "#12b886", "#fa5252", "#fab005",
            "#7950f2", "#15aabf", "#fd7e14", "#e64980",
          ]}
        />
        {profile.counts && (
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Owned data</Text>
            <Group gap="xs">
              <Badge variant="light">{profile.counts.transactions} transactions</Badge>
              <Badge variant="light">{profile.counts.manual_accounts} accounts</Badge>
              <Badge variant="light">{profile.counts.pending_receipts} pending receipts</Badge>
              <Badge variant="light">{profile.counts.upload_log} uploads</Badge>
            </Group>
            {totalRows > 0 && (
              <Text size="xs" c="dimmed">
                Reassign or delete these rows before this profile can be removed.
              </Text>
            )}
          </Stack>
        )}
        <Group justify="space-between" mt="sm">
          <div>
            {!profile.is_default && (
              <Button color="red" variant="light" onClick={handleDelete} disabled={busy}>
                Delete profile
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

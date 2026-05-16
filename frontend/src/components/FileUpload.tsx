import { SimpleGrid, Group, Text, Badge } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { IconUpload, IconFileSpreadsheet, IconRefresh, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import api from "../api/client";
import { useActiveProfile } from "../context/ActiveProfile";
import { useProfiles } from "../hooks/useProfiles";

interface Props {
  onUploaded: () => void;
}

export default function FileUpload({ onUploaded }: Props) {
  const { activeProfileId } = useActiveProfile();
  const { profiles } = useProfiles();
  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;

  const requireProfile = (): number | null => {
    if (activeProfileId == null) {
      notifications.show({
        title: "Pick a profile first",
        message: "Switch from Combined to a specific profile before uploading.",
        color: "yellow",
      });
      return null;
    }
    return activeProfileId;
  };

  const handleDrop = async (files: File[]) => {
    const profileId = requireProfile();
    if (profileId == null) return;
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      form.append("profile_id", String(profileId));
      try {
        const res = await api.post("/upload", form);
        const { inserted } = res.data;
        notifications.show({
          title: `Uploaded ${file.name}`,
          message: `${inserted} transactions imported`,
          color: "green",
        });
      } catch (err: any) {
        const msg = err.response?.data?.error || "Upload failed";
        notifications.show({
          title: `Error uploading ${file.name}`,
          message: msg,
          color: "red",
        });
      }
    }
    onUploaded();
  };

  const handleBalanceDrop = async (files: File[]) => {
    const profileId = requireProfile();
    if (profileId == null) return;
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      form.append("profile_id", String(profileId));
      try {
        const res = await api.post("/upload-balances", form);
        const { matched, unmatched } = res.data;
        notifications.show({
          title: `Updated balances from ${file.name}`,
          message: `${matched} balances updated, ${unmatched} unmatched rows`,
          color: "blue",
        });
      } catch (err: any) {
        const msg = err.response?.data?.error || "Balance update failed";
        notifications.show({
          title: `Error updating balances from ${file.name}`,
          message: msg,
          color: "red",
        });
      }
    }
    onUploaded();
  };

  const csvAccept = {
    "text/csv": [".csv"],
    "application/vnd.ms-excel": [".csv"],
  };

  return (
    <>
      <Group mb="xs">
        <Text size="xs" c="dimmed">Uploading to:</Text>
        <Badge variant="light" color={activeProfile ? "blue" : "yellow"}>
          {activeProfile ? activeProfile.name : "Combined — pick a profile in the header"}
        </Badge>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2 }} mb="md">
      <Dropzone onDrop={handleDrop} accept={csvAccept}>
        <Group justify="center" gap="xl" mih={80} style={{ pointerEvents: "none" }}>
          <Dropzone.Accept>
            <IconUpload size={32} stroke={1.5} />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX size={32} stroke={1.5} />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconFileSpreadsheet size={32} stroke={1.5} />
          </Dropzone.Idle>
          <div>
            <Text size="lg" inline>
              Upload Transactions
            </Text>
            <Text size="sm" c="dimmed" inline mt={4}>
              Drop CSV files to import new transactions
            </Text>
          </div>
        </Group>
      </Dropzone>
      <Dropzone onDrop={handleBalanceDrop} accept={csvAccept}>
        <Group justify="center" gap="xl" mih={80} style={{ pointerEvents: "none" }}>
          <Dropzone.Accept>
            <IconUpload size={32} stroke={1.5} />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX size={32} stroke={1.5} />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconRefresh size={32} stroke={1.5} />
          </Dropzone.Idle>
          <div>
            <Text size="lg" inline>
              Update Balances
            </Text>
            <Text size="sm" c="dimmed" inline mt={4}>
              Re-upload CSV to add balance data (no duplicates)
            </Text>
          </div>
        </Group>
      </Dropzone>
    </SimpleGrid>
    </>
  );
}

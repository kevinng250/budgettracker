import { SimpleGrid, Group, Text } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { IconUpload, IconFileSpreadsheet, IconRefresh, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import api from "../api/client";

interface Props {
  onUploaded: () => void;
}

export default function FileUpload({ onUploaded }: Props) {
  const handleDrop = async (files: File[]) => {
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
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
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
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
  );
}

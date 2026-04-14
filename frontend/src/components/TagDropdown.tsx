import { useState } from "react";
import { Select, Modal, Text, Group, Button } from "@mantine/core";
import api from "../api/client";
import type { Tag } from "../types";

interface Props {
  transactionId: number;
  description: string;
  currentTag: string;
  tags: Tag[];
  onUpdated: () => void;
}

export default function TagDropdown({
  transactionId,
  description,
  currentTag,
  tags,
  onUpdated,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingTag, setPendingTag] = useState("");
  const [othersCount, setOthersCount] = useState(0);

  const handleChange = async (value: string | null) => {
    if (!value || value === currentTag) return;
    const res = await api.patch(`/transactions/${transactionId}`, { tag: value });
    const { others_count } = res.data;
    if (others_count > 0) {
      setPendingTag(value);
      setOthersCount(others_count);
      setModalOpen(true);
    } else {
      onUpdated();
    }
  };

  const handleBulkUpdate = async () => {
    await api.patch(`/transactions/${transactionId}`, {
      tag: pendingTag,
      bulk: true,
    });
    setModalOpen(false);
    onUpdated();
  };

  const handleSkip = () => {
    setModalOpen(false);
    onUpdated();
  };

  return (
    <>
      <Select
        value={currentTag}
        onChange={handleChange}
        data={tags.map((t) => t.name)}
        size="xs"
        w={140}
        allowDeselect={false}
      />
      <Modal
        opened={modalOpen}
        onClose={handleSkip}
        title="Update matching transactions?"
        centered
      >
        <Text size="sm" mb="md">
          There {othersCount === 1 ? "is" : "are"}{" "}
          <Text span fw={700}>{othersCount}</Text> other transaction
          {othersCount !== 1 && "s"} with the description{" "}
          <Text span fw={700}>"{description}"</Text>. Update them all to{" "}
          <Text span fw={700}>"{pendingTag}"</Text>?
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={handleSkip}>
            No, just this one
          </Button>
          <Button onClick={handleBulkUpdate}>
            Yes, update all
          </Button>
        </Group>
      </Modal>
    </>
  );
}

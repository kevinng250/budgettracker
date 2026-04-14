import { useState } from "react";
import {
  Table,
  TextInput,
  Button,
  Group,
  ActionIcon,
  Badge,
  Text,
} from "@mantine/core";
import { IconTrash, IconEdit, IconCheck, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import api from "../api/client";
import type { Tag } from "../types";

interface Props {
  tags: Tag[];
  onRefresh: () => void;
}

export default function TagManager({ tags, onRefresh }: Props) {
  const [newTag, setNewTag] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleAdd = async () => {
    const name = newTag.trim().toLowerCase();
    if (!name) return;
    try {
      await api.post("/tags", { name });
      setNewTag("");
      onRefresh();
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.error || "Failed to create tag",
        color: "red",
      });
    }
  };

  const handleRename = async (oldName: string) => {
    const name = editName.trim().toLowerCase();
    if (!name || name === oldName) {
      setEditingTag(null);
      return;
    }
    try {
      await api.patch(`/tags/${oldName}`, { name });
      setEditingTag(null);
      onRefresh();
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.error || "Failed to rename tag",
        color: "red",
      });
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await api.delete(`/tags/${name}`);
      onRefresh();
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.error || "Failed to delete tag",
        color: "red",
      });
    }
  };

  return (
    <>
      <Group mb="md">
        <TextInput
          placeholder="New tag name..."
          value={newTag}
          onChange={(e) => setNewTag(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button onClick={handleAdd}>Add Tag</Button>
      </Group>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Tag</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {tags.map((tag) => (
            <Table.Tr key={tag.name}>
              <Table.Td>
                {editingTag === tag.name ? (
                  <Group gap="xs">
                    <TextInput
                      size="xs"
                      value={editName}
                      onChange={(e) => setEditName(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(tag.name);
                        if (e.key === "Escape") setEditingTag(null);
                      }}
                      autoFocus
                    />
                    <ActionIcon
                      size="sm"
                      color="green"
                      variant="subtle"
                      onClick={() => handleRename(tag.name)}
                    >
                      <IconCheck size={14} />
                    </ActionIcon>
                    <ActionIcon
                      size="sm"
                      color="gray"
                      variant="subtle"
                      onClick={() => setEditingTag(null)}
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  </Group>
                ) : (
                  <Text>{tag.name}</Text>
                )}
              </Table.Td>
              <Table.Td>
                <Badge
                  variant="light"
                  color={tag.is_default ? "blue" : "green"}
                  size="sm"
                >
                  {tag.is_default ? "Default" : "Custom"}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    onClick={() => {
                      setEditingTag(tag.name);
                      setEditName(tag.name);
                    }}
                  >
                    <IconEdit size={14} />
                  </ActionIcon>
                  {!tag.is_default && (
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={() => handleDelete(tag.name)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  )}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </>
  );
}

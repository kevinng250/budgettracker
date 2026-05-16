import { useState, useMemo } from "react";
import {
  Card,
  Group,
  TextInput,
  ActionIcon,
  Badge,
  Text,
  Affix,
  Menu,
  SimpleGrid,
} from "@mantine/core";
import {
  IconTrash,
  IconEdit,
  IconCheck,
  IconX,
  IconFolder,
  IconPlus,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import api from "../api/client";
import type { Tag, Category } from "../types";
import TagEditModal from "./TagEditModal";
import AddCategoryModal from "./AddCategoryModal";
import AddTagModal from "./AddTagModal";

interface Props {
  tags: Tag[];
  categories: Category[];
  onRefresh: () => void;
}

export default function TagsDirectory({ tags, categories, onRefresh }: Props) {
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [addTagOpen, setAddTagOpen] = useState(false);
  const [addTagDefaultCategory, setAddTagDefaultCategory] = useState<string>("");

  const tagsByCategory = useMemo(() => {
    const map: Record<string, Tag[]> = {};
    const equivalentNames = (a: string, b: string) => {
      const al = a.toLowerCase();
      const bl = b.toLowerCase();
      if (al === bl) return true;
      if (al.endsWith("s") && al.slice(0, -1) === bl) return true;
      if (bl.endsWith("s") && bl.slice(0, -1) === al) return true;
      return false;
    };
    for (const t of tags) {
      if (t.is_category) continue;
      if (t.category && equivalentNames(t.name, t.category)) continue;
      const key = t.category ?? "__uncategorized__";
      (map[key] ||= []).push(t);
    }
    return map;
  }, [tags]);

  const uncategorizedTags = tagsByCategory["__uncategorized__"] ?? [];

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  const showError = (err: any, fallback: string) => {
    notifications.show({
      title: "Error",
      message: err.response?.data?.error || fallback,
      color: "red",
    });
  };

  const handleRenameCategory = async (oldName: string) => {
    const name = editCategoryName.trim();
    if (!name || name === oldName) {
      setEditingCategory(null);
      return;
    }
    try {
      await api.patch(`/categories/${encodeURIComponent(oldName)}`, { name });
      setEditingCategory(null);
      onRefresh();
    } catch (err: any) {
      showError(err, "Failed to rename category");
    }
  };

  const handleDeleteCategory = async (name: string) => {
    if (!window.confirm(
      `Delete "${name}"? Tags assigned to it will become uncategorized.`
    )) return;
    try {
      await api.delete(`/categories/${encodeURIComponent(name)}`);
      onRefresh();
    } catch (err: any) {
      showError(err, "Failed to delete category");
    }
  };

  const renderTagPill = (tag: Tag) => (
    <Badge
      key={tag.name}
      variant="light"
      color={tag.is_default ? "gray" : "teal"}
      size="md"
      radius="sm"
      style={{ cursor: "pointer", textTransform: "none", fontWeight: 500 }}
      onClick={() => setEditingTag(tag)}
      className="tag-pill"
    >
      {tag.name}
    </Badge>
  );

  const renderCategoryCard = (cat: Category) => {
    const tagList = tagsByCategory[cat.name] ?? [];
    const isEditing = editingCategory === cat.name;

    return (
      <Card key={cat.name} withBorder padding="md" radius="md">
        <Group justify="space-between" wrap="nowrap" mb={tagList.length > 0 ? "sm" : 0}>
          <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            {isEditing ? (
              <TextInput
                size="sm"
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameCategory(cat.name);
                  if (e.key === "Escape") setEditingCategory(null);
                }}
                autoFocus
                style={{ flex: 1 }}
              />
            ) : (
              <Text fw={600} size="md" truncate>
                {cat.name}
              </Text>
            )}
          </Group>
          <Group gap={2} wrap="nowrap">
            {isEditing ? (
              <>
                <ActionIcon
                  size="sm"
                  color="green"
                  variant="subtle"
                  onClick={() => handleRenameCategory(cat.name)}
                >
                  <IconCheck size={14} />
                </ActionIcon>
                <ActionIcon
                  size="sm"
                  color="gray"
                  variant="subtle"
                  onClick={() => setEditingCategory(null)}
                >
                  <IconX size={14} />
                </ActionIcon>
              </>
            ) : (
              <>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  color="gray"
                  onClick={() => {
                    setEditingCategory(cat.name);
                    setEditCategoryName(cat.name);
                  }}
                  aria-label={`Rename ${cat.name}`}
                >
                  <IconEdit size={14} />
                </ActionIcon>
                {!cat.is_default && (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => handleDeleteCategory(cat.name)}
                    aria-label={`Delete ${cat.name}`}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                )}
              </>
            )}
          </Group>
        </Group>
        {tagList.length > 0 && (
          <Group gap={6}>
            {tagList.map(renderTagPill)}
          </Group>
        )}
      </Card>
    );
  };

  return (
    <>
      <style>{`
        .tag-pill:hover {
          filter: brightness(0.94);
        }
      `}</style>

      <SimpleGrid
        cols={{ base: 1, md: 2, lg: 3 }}
        spacing="md"
        style={{ alignItems: "start" }}
      >
        {sortedCategories.map(renderCategoryCard)}
        {uncategorizedTags.length > 0 && (
          <Card withBorder padding="md" radius="md">
            <Group justify="space-between" wrap="nowrap" mb="sm">
              <Text fw={600} size="md" c="dimmed">
                Uncategorized
              </Text>
            </Group>
            <Group gap={6}>
              {uncategorizedTags.map(renderTagPill)}
            </Group>
          </Card>
        )}
      </SimpleGrid>

      <Affix position={{ bottom: 24, right: 24 }}>
        <Menu shadow="md" position="top-end" withArrow>
          <Menu.Target>
            <ActionIcon
              size={56}
              radius="xl"
              variant="filled"
              color="blue"
              aria-label="Add"
            >
              <IconPlus size={26} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Create</Menu.Label>
            <Menu.Item
              leftSection={<IconFolder size={14} />}
              onClick={() => setAddCategoryOpen(true)}
            >
              New Category
            </Menu.Item>
            <Menu.Item
              leftSection={<IconPlus size={14} />}
              onClick={() => {
                setAddTagDefaultCategory("");
                setAddTagOpen(true);
              }}
            >
              New Tag
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Affix>

      <TagEditModal
        tag={editingTag}
        categories={categories}
        onClose={() => setEditingTag(null)}
        onSaved={onRefresh}
      />
      <AddCategoryModal
        opened={addCategoryOpen}
        onClose={() => setAddCategoryOpen(false)}
        onCreated={onRefresh}
      />
      <AddTagModal
        opened={addTagOpen}
        categories={categories}
        defaultCategory={addTagDefaultCategory}
        onClose={() => setAddTagOpen(false)}
        onCreated={onRefresh}
      />
    </>
  );
}

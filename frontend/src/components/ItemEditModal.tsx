import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Stack,
  Group,
  Button,
  TextInput,
  NumberInput,
  TagsInput,
  Text,
  Textarea,
  Autocomplete,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import api from "../api/client";
import type { ItemTag, ReceiptItem } from "../types";

interface Props {
  item: ReceiptItem | null;
  itemTags: ItemTag[];
  onClose: () => void;
  onSaved: () => void;
}

const COMMON_UNITS = [
  "lb", "oz", "g", "kg",
  "gal", "qt", "pt", "fl oz", "L", "mL",
  "each", "ct", "pack", "dozen", "egg", "slice",
  "can", "jar", "bottle", "bag", "box", "loaf",
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default function ItemEditModal({ item, itemTags, onClose, onSaved }: Props) {
  const [description, setDescription] = useState("");
  const [lineTotal, setLineTotal] = useState<number | string>("");
  const [quantity, setQuantity] = useState<number | string>("");
  const [unit, setUnit] = useState("");
  const [unitPrice, setUnitPrice] = useState<number | string>("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // Track whether the user manually touched these fields so auto-fills don't
  // clobber explicit choices.
  const [unitPriceTouched, setUnitPriceTouched] = useState(false);
  const [unitTouched, setUnitTouched] = useState(false);
  const initializedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!item) return;
    // Reset state when a different item is opened.
    if (initializedFor.current !== item.id) {
      setDescription(item.description ?? "");
      setLineTotal(item.line_total ?? "");
      setQuantity(item.quantity ?? "");
      setUnit(item.unit ?? "");
      setUnitPrice(item.unit_price ?? "");
      setNotes(item.notes ?? "");
      setTags(item.item_tags ?? []);
      // If the item already has a unit_price/unit, treat them as user-set so
      // auto-fill doesn't overwrite.
      setUnitPriceTouched(item.unit_price != null);
      setUnitTouched(!!item.unit);
      initializedFor.current = item.id;
    }
  }, [item]);

  // Auto-compute unit_price from line_total / quantity unless user has overridden.
  const computedUnitPrice = useMemo(() => {
    const q = typeof quantity === "number" ? quantity : Number(quantity);
    const l = typeof lineTotal === "number" ? lineTotal : Number(lineTotal);
    if (!Number.isFinite(q) || q === 0) return null;
    if (!Number.isFinite(l)) return null;
    return Math.round((l / q) * 10000) / 10000;
  }, [lineTotal, quantity]);

  useEffect(() => {
    if (!unitPriceTouched && computedUnitPrice != null) {
      setUnitPrice(computedUnitPrice);
    }
  }, [computedUnitPrice, unitPriceTouched]);

  // When the user adds grocery tags and hasn't set a unit yet, default to the
  // most-recently-used unit for the first tag that has one recorded.
  useEffect(() => {
    if (unitTouched) return;
    for (const t of tags) {
      const known = itemTags.find((x) => x.name === t);
      if (known?.last_unit) {
        setUnit(known.last_unit);
        return;
      }
    }
  }, [tags, itemTags, unitTouched]);

  if (!item) return null;

  const showError = (err: any, fallback: string) =>
    notifications.show({
      title: "Error",
      message: err.response?.data?.error || fallback,
      color: "red",
    });

  const handleSave = async () => {
    setBusy(true);
    try {
      await api.patch(`/items/${item.id}`, {
        description: description.trim(),
        line_total: Number(lineTotal) || 0,
        quantity: quantity === "" ? null : Number(quantity),
        unit: unit.trim() || null,
        unit_price: unitPrice === "" ? null : Number(unitPrice),
        notes: notes.trim() || null,
      });
      await api.put(`/items/${item.id}/tags`, { item_tags: tags });
      onSaved();
      onClose();
    } catch (err: any) {
      showError(err, "Failed to save item");
    } finally {
      setBusy(false);
    }
  };

  const unitPriceHint =
    computedUnitPrice != null
      ? unitPriceTouched
        ? `Auto would be $${computedUnitPrice.toFixed(4)} (line / qty). Clear field to re-enable auto.`
        : "Auto: line ÷ quantity"
      : "Enter manually or set quantity to compute";

  return (
    <Modal opened={!!item} onClose={onClose} title={`Edit "${item.description}"`} size="lg" centered>
      <Stack>
        <TextInput
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
        <Group grow>
          <NumberInput
            label="Line total"
            value={lineTotal}
            onChange={(v) => setLineTotal(v ?? "")}
            prefix="$"
            decimalScale={2}
          />
          <NumberInput
            label="Quantity"
            value={quantity}
            onChange={(v) => setQuantity(v ?? "")}
            decimalScale={3}
            description="e.g. 2 (eggs in a 2-pack? no — count of base units), 1.42 (lb of chicken)"
          />
        </Group>
        <Group grow>
          <Autocomplete
            label="Unit"
            placeholder="lb, oz, egg, each..."
            value={unit}
            onChange={(v) => {
              setUnit(v);
              setUnitTouched(true);
            }}
            data={COMMON_UNITS}
            description="The base unit you're pricing per. Stays consistent across purchases of the same product."
          />
          <NumberInput
            label="Price per unit"
            value={unitPrice}
            onChange={(v) => {
              setUnitPrice(v ?? "");
              setUnitPriceTouched(v !== "" && v !== null);
            }}
            prefix="$"
            decimalScale={4}
            description={unitPriceHint}
          />
        </Group>
        <TagsInput
          label="Grocery tags"
          placeholder="bananas, eggs, chicken thighs..."
          description="Identifies what this item is. Separate from the transaction tags used for budgeting. Type and press Enter to add; tags auto-create on save."
          value={tags}
          onChange={setTags}
          data={itemTags.map((t) => t.name)}
          splitChars={[","]}
          clearable
        />
        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          rows={2}
          autosize
        />
        {item.image_path && (
          <Text size="xs" c="dimmed">Image: {item.image_path}</Text>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleSave} loading={busy}>Save</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

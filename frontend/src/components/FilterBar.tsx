import { Group, TextInput, Select } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconSearch } from "@tabler/icons-react";
import type { Tag, BankAccount } from "../types";

interface Props {
  dateFrom: Date | null;
  dateTo: Date | null;
  bank: string;
  tag: string;
  search: string;
  tags: Tag[];
  bankAccounts: BankAccount[];
  onDateFromChange: (d: Date | null) => void;
  onDateToChange: (d: Date | null) => void;
  onBankChange: (v: string) => void;
  onTagChange: (v: string) => void;
  onSearchChange: (v: string) => void;
}

export default function FilterBar(props: Props) {
  const bankOptions = [
    { value: "", label: "All Banks" },
    ...props.bankAccounts.map((ba) => ({
      value: `${ba.bank}|${ba.account}`,
      label: `${ba.bank} - ${ba.account}`,
    })),
  ];

  const tagOptions = [
    { value: "", label: "All Tags" },
    ...props.tags.map((t) => ({ value: t.name, label: t.name })),
  ];

  return (
    <Group mb="md" gap="sm" wrap="wrap">
      <DatePickerInput
        placeholder="From"
        value={props.dateFrom}
        onChange={props.onDateFromChange}
        clearable
        size="sm"
        w={150}
      />
      <DatePickerInput
        placeholder="To"
        value={props.dateTo}
        onChange={props.onDateToChange}
        clearable
        size="sm"
        w={150}
      />
      <Select
        placeholder="Bank"
        value={props.bank}
        onChange={(v) => props.onBankChange(v || "")}
        data={bankOptions}
        size="sm"
        w={200}
        allowDeselect={false}
      />
      <Select
        placeholder="Tag"
        value={props.tag}
        onChange={(v) => props.onTagChange(v || "")}
        data={tagOptions}
        size="sm"
        w={160}
        allowDeselect={false}
      />
      <TextInput
        placeholder="Search description..."
        value={props.search}
        onChange={(e) => props.onSearchChange(e.currentTarget.value)}
        leftSection={<IconSearch size={16} />}
        size="sm"
        w={220}
      />
    </Group>
  );
}

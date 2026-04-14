import { useState } from "react";
import { Paper, Title, Text, Group, ActionIcon, Table, SegmentedControl } from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { SpendingByTag as SpendingByTagType } from "../types";

const COLORS = [
  "#4c6ef5", "#7950f2", "#be4bdb", "#e64980", "#fa5252",
  "#fd7e14", "#fab005", "#40c057", "#12b886", "#15aabf",
  "#228be6", "#868e96",
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface Props {
  data: SpendingByTagType[];
  month: Date;
  onPrev: () => void;
  onNext: () => void;
}

export default function SpendingByTag({ data, month, onPrev, onNext }: Props) {
  const [view, setView] = useState("table");
  const label = `${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}`;
  const grandTotal = data.reduce((sum, d) => sum + d.total, 0);

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="sm">
        <ActionIcon variant="subtle" onClick={onPrev}>
          <IconChevronLeft size={18} />
        </ActionIcon>
        <Title order={4}>{label}</Title>
        <ActionIcon variant="subtle" onClick={onNext}>
          <IconChevronRight size={18} />
        </ActionIcon>
      </Group>

      <Group justify="center" mb="sm">
        <SegmentedControl
          value={view}
          onChange={setView}
          data={[
            { label: "Chart", value: "chart" },
            { label: "Table", value: "table" },
          ]}
          size="xs"
        />
      </Group>

      {data.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">No spending data this month</Text>
      ) : view === "chart" ? (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="tag"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ tag, percent }) =>
                `${tag} (${(percent * 100).toFixed(0)}%)`
              }
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => `$${value.toFixed(2)}`}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Category</Table.Th>
              <Table.Th style={{ textAlign: "right" }}>Amount</Table.Th>
              <Table.Th style={{ textAlign: "right" }}>%</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((row) => (
              <Table.Tr key={row.tag}>
                <Table.Td>{row.tag}</Table.Td>
                <Table.Td style={{ textAlign: "right" }}>
                  <Text fw={500}>${row.total.toFixed(2)}</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: "right" }}>
                  <Text c="dimmed">
                    {grandTotal > 0
                      ? ((row.total / grandTotal) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
            <Table.Tr>
              <Table.Td><Text fw={700}>Total</Text></Table.Td>
              <Table.Td style={{ textAlign: "right" }}>
                <Text fw={700}>${grandTotal.toFixed(2)}</Text>
              </Table.Td>
              <Table.Td style={{ textAlign: "right" }}>
                <Text fw={700}>100%</Text>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}

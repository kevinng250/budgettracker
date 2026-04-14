import { AppShell, NavLink, Title, Group } from "@mantine/core";
import {
  IconDashboard,
  IconReceipt,
  IconTags,
} from "@tabler/icons-react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/", icon: IconDashboard },
  { label: "Transactions", path: "/transactions", icon: IconReceipt },
  { label: "Tags", path: "/tags", icon: IconTags },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AppShell
      navbar={{ width: 220, breakpoint: "sm" }}
      padding="md"
    >
      <AppShell.Navbar p="sm">
        <Group mb="md" px="xs">
          <Title order={4}>Budget Tracker</Title>
        </Group>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            label={item.label}
            leftSection={<item.icon size={18} />}
            active={location.pathname === item.path}
            onClick={() => navigate(item.path)}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}

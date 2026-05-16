import { AppShell, NavLink, Title, Group, Burger, Menu, Button, Box } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconDashboard,
  IconReceipt,
  IconTags,
  IconBookmark,
  IconUpload,
  IconCamera,
  IconBasket,
  IconInbox,
  IconUsers,
  IconChevronDown,
} from "@tabler/icons-react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useProfiles } from "../hooks/useProfiles";
import { useActiveProfile } from "../context/ActiveProfile";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/", icon: IconDashboard, exact: true },
  { label: "Transactions", path: "/transactions", icon: IconReceipt },
  { label: "Tags", path: "/tags", icon: IconTags },
  { label: "Labels", path: "/labels", icon: IconBookmark },
  { label: "Uploads", path: "/uploads", icon: IconUpload },
  { label: "Receipts", path: "/receipts", icon: IconCamera, exact: true },
  { label: "Review Queue", path: "/receipts/queue", icon: IconInbox },
  { label: "Items", path: "/items", icon: IconBasket },
  { label: "Profiles", path: "/profiles", icon: IconUsers },
];

function isActive(pathname: string, item: { path: string; exact?: boolean }) {
  if (item.exact) return pathname === item.path;
  return pathname === item.path || pathname.startsWith(item.path + "/");
}

function ColorDot({ color }: { color: string | null | undefined }) {
  if (!color) return null;
  return (
    <Box
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: color,
        display: "inline-block",
      }}
    />
  );
}

function ProfileSwitcher() {
  const { profiles } = useProfiles();
  const { activeProfileId, setActiveProfileId } = useActiveProfile();

  const active = profiles.find((p) => p.id === activeProfileId) ?? null;
  const label = active ? active.name : "Combined";

  return (
    <Menu shadow="md" position="bottom-start" width={200}>
      <Menu.Target>
        <Button
          variant="subtle"
          size="xs"
          rightSection={<IconChevronDown size={14} />}
          leftSection={active?.color ? <ColorDot color={active.color} /> : undefined}
        >
          {label}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>View as</Menu.Label>
        <Menu.Item
          onClick={() => setActiveProfileId(null)}
          rightSection={activeProfileId == null ? "✓" : null}
        >
          Combined (household)
        </Menu.Item>
        <Menu.Divider />
        {profiles.map((p) => (
          <Menu.Item
            key={p.id}
            onClick={() => setActiveProfileId(p.id)}
            leftSection={<ColorDot color={p.color} />}
            rightSection={activeProfileId === p.id ? "✓" : null}
          >
            {p.name}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [opened, { toggle, close }] = useDisclosure(false);

  const handleNavigate = (path: string) => {
    navigate(path);
    if (opened) close();
  };

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: 220,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" gap="sm" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              aria-label="Toggle navigation"
            />
            <Title order={4}>Budget Tracker</Title>
          </Group>
          <ProfileSwitcher />
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="sm">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            label={item.label}
            leftSection={<item.icon size={18} />}
            active={isActive(location.pathname, item)}
            onClick={() => handleNavigate(item.path)}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}

import { MantineProvider } from "@mantine/core";
import { theme } from "./theme/mantine-theme";
import "@mantine/core/styles.css";
import {
  Stack,
  Title,
  Text,
  Center,
  Badge,
  Group,
  Card,
  SimpleGrid,
  Container,
} from "@mantine/core";

function LandingPage() {
  return (
    <Center
      mih="100vh"
      style={{
        background:
          "linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f3460 100%)",
      }}
    >
      <Container size="sm">
        <Stack align="center" gap="xl" py="xl">
          <Badge size="lg" variant="light" color="blue" radius="sm">
            Coming Soon
          </Badge>

          <Stack align="center" gap="xs">
            <Text size="sm" c="dimmed" tt="uppercase" fw={600} ls={4}>
              That Infrastructure Guy presents
            </Text>
            <Title
              order={1}
              ta="center"
              style={{
                fontSize: "clamp(2.5rem, 6vw, 4rem)",
                background:
                  "linear-gradient(135deg, #e2e8f0, #60a5fa, #a78bfa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                lineHeight: 1.1,
              }}
            >
              PulsCI
            </Title>
            <Text size="lg" c="dimmed" ta="center" maw={450}>
              Your builds talk. We translate.
            </Text>
          </Stack>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mt="lg">
            <Card
              withBorder
              radius="md"
              style={{
                backgroundColor: "rgba(255,255,255,0.03)",
                borderColor: "rgba(255,255,255,0.08)",
              }}
            >
              <Stack gap="xs">
                <Text size="xl">01</Text>
                <Text size="sm" fw={600}>
                  Build fails
                </Text>
                <Text size="xs" c="dimmed">
                  Your CI pipeline breaks. Jenkins shows a wall of logs. Nobody
                  knows what happened.
                </Text>
              </Stack>
            </Card>
            <Card
              withBorder
              radius="md"
              style={{
                backgroundColor: "rgba(255,255,255,0.03)",
                borderColor: "rgba(255,255,255,0.08)",
              }}
            >
              <Stack gap="xs">
                <Text size="xl">02</Text>
                <Text size="sm" fw={600}>
                  PulsCI reads it
                </Text>
                <Text size="xs" c="dimmed">
                  Instant failure analysis. Infra or code? What broke? Plain
                  English, not log soup.
                </Text>
              </Stack>
            </Card>
            <Card
              withBorder
              radius="md"
              style={{
                backgroundColor: "rgba(255,255,255,0.03)",
                borderColor: "rgba(255,255,255,0.08)",
              }}
            >
              <Stack gap="xs">
                <Text size="xl">03</Text>
                <Text size="sm" fw={600}>
                  You fix it
                </Text>
                <Text size="xs" c="dimmed">
                  Step-by-step remediation. No DevOps ping required. Ship and
                  move on.
                </Text>
              </Stack>
            </Card>
          </SimpleGrid>

          <Group gap="lg" mt="md">
            <Stack gap={2} align="center">
              <Text size="xl" fw={700} c="blue">
                &lt; 2 min
              </Text>
              <Text size="xs" c="dimmed">
                to understand a failure
              </Text>
            </Stack>
            <Stack gap={2} align="center">
              <Text size="xl" fw={700} c="green">
                0
              </Text>
              <Text size="xs" c="dimmed">
                DevOps pings needed
              </Text>
            </Stack>
            <Stack gap={2} align="center">
              <Text size="xl" fw={700} c="violet">
                12+
              </Text>
              <Text size="xs" c="dimmed">
                failure patterns detected
              </Text>
            </Stack>
          </Group>

          <Text size="xs" c="dimmed" mt="xl">
            Self-hosted CI/CD diagnostics for teams that want to ship, not
            debug.
          </Text>
        </Stack>
      </Container>
    </Center>
  );
}

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <LandingPage />
    </MantineProvider>
  );
}

import { MantineProvider } from "@mantine/core";
import { theme } from "./theme/mantine-theme";
import "@mantine/core/styles.css";
import { useEffect, useState } from "react";
import {
  Stack,
  Title,
  Text,
  Badge,
  Group,
  Card,
  SimpleGrid,
  Container,
  Box,
} from "@mantine/core";

const TERMINAL_LINES = [
  { text: "$ docker compose up", color: "#34d399", delay: 0 },
  { text: "  [+] postgres-16 .......... healthy", color: "#60a5fa", delay: 800 },
  { text: "  [+] tig-api .............. running", color: "#60a5fa", delay: 1400 },
  { text: "  [+] tig-worker ........... running", color: "#60a5fa", delay: 2000 },
  { text: "", color: "", delay: 2600 },
  { text: "$ tig crawl --instance production", color: "#34d399", delay: 3000 },
  { text: "  Discovering jobs ......... 47 found", color: "#a78bfa", delay: 3800 },
  { text: "  Syncing builds ........... 312 builds", color: "#a78bfa", delay: 4400 },
  { text: "  Analyzing failures ....... 8 failed", color: "#f87171", delay: 5000 },
  { text: "", color: "", delay: 5600 },
  { text: "  BUILD #1416  Neteera-Backend", color: "#f87171", delay: 6000 },
  { text: "    Classification: Code Issue", color: "#fb923c", delay: 6500 },
  { text: '    Pattern: "Compilation Error"', color: "#fbbf24", delay: 7000 },
  { text: "    Confidence: 95%", color: "#34d399", delay: 7500 },
  { text: "", color: "", delay: 8000 },
  { text: "  Ready. Your builds talk. We translate.", color: "#34d399", delay: 8500 },
];

const CURSOR_BLINK = `
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
`;

function TerminalAnimation() {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    const timers = TERMINAL_LINES.map((line, idx) =>
      setTimeout(() => setVisibleLines(idx + 1), line.delay),
    );

    const resetTimer = setTimeout(() => {
      setVisibleLines(0);
      const restartTimers = TERMINAL_LINES.map((line, idx) =>
        setTimeout(() => setVisibleLines(idx + 1), line.delay),
      );
      return () => restartTimers.forEach(clearTimeout);
    }, 12000);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(resetTimer);
    };
  }, []);

  // Restart loop
  useEffect(() => {
    if (visibleLines === 0) {
      const timers = TERMINAL_LINES.map((line, idx) =>
        setTimeout(() => setVisibleLines(idx + 1), line.delay),
      );
      return () => timers.forEach(clearTimeout);
    }
  }, [visibleLines]);

  return (
    <Box
      style={{
        width: 340,
        flexShrink: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <style>{CURSOR_BLINK}</style>

      {/* Title bar */}
      <Box
        px="sm"
        py={8}
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Box
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            backgroundColor: "#f87171",
          }}
        />
        <Box
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            backgroundColor: "#fbbf24",
          }}
        />
        <Box
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            backgroundColor: "#34d399",
          }}
        />
        <Text size="xs" c="dimmed" ml="xs">
          pulsci
        </Text>
      </Box>

      {/* Terminal body */}
      <Box
        px="sm"
        py="sm"
        style={{
          fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontSize: 11,
          lineHeight: 1.7,
          minHeight: 300,
        }}
      >
        {TERMINAL_LINES.slice(0, visibleLines).map((line, idx) => (
          <div key={idx} style={{ color: line.color, minHeight: 18 }}>
            {line.text}
          </div>
        ))}
        <span
          style={{
            display: "inline-block",
            width: 7,
            height: 14,
            backgroundColor: "#34d399",
            animation: "blink 1s step-end infinite",
            verticalAlign: "middle",
          }}
        />
      </Box>
    </Box>
  );
}

function LandingPage() {
  return (
    <Box
      mih="100vh"
      style={{
        background:
          "linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f3460 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Container size="md">
        <Group
          align="center"
          justify="center"
          gap={60}
          wrap="nowrap"
        >
          <Box visibleFrom="sm">
            <TerminalAnimation />
          </Box>

          <Stack align="center" gap="xl" py="xl" style={{ flex: 1 }}>
            <Badge size="lg" variant="light" color="blue" radius="sm">
              Under Construction
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
                    Your CI pipeline breaks. Jenkins shows a wall of logs.
                    Nobody knows what happened.
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
        </Group>
      </Container>
    </Box>
  );
}

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <LandingPage />
    </MantineProvider>
  );
}

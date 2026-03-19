import { MantineProvider } from "@mantine/core";
import { theme } from "./theme/mantine-theme";
import "@mantine/core/styles.css";
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

const keyframes = `
@keyframes crane-swing {
  0%, 100% { transform: rotate(-5deg); }
  50% { transform: rotate(5deg); }
}
@keyframes block-drop {
  0% { transform: translateY(-20px); opacity: 0; }
  60% { transform: translateY(2px); opacity: 1; }
  80% { transform: translateY(-3px); }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes pulse-glow {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.8; }
}
@keyframes gear-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

function ConstructionAnimation() {
  return (
    <Box
      style={{
        width: 200,
        height: 320,
        position: "relative",
        flexShrink: 0,
      }}
    >
      <style>{keyframes}</style>
      <svg viewBox="0 0 200 320" width="200" height="320">
        {/* Crane base */}
        <rect x="85" y="280" width="30" height="40" rx="2" fill="#334155" />
        <rect x="95" y="60" width="10" height="220" fill="#475569" />

        {/* Crane arm */}
        <g
          style={{
            transformOrigin: "100px 60px",
            animation: "crane-swing 4s ease-in-out infinite",
          }}
        >
          <rect x="40" y="55" width="120" height="8" rx="2" fill="#60a5fa" />
          {/* Cable */}
          <line
            x1="60"
            y1="63"
            x2="60"
            y2="120"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
          {/* Hook */}
          <path
            d="M55 118 L60 125 L65 118"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>

        {/* Building blocks - stacking up */}
        <g>
          {/* Bottom row */}
          <rect x="30" y="250" width="55" height="30" rx="3" fill="#1e3a5f" stroke="#60a5fa" strokeWidth="0.5" />
          <rect x="90" y="250" width="55" height="30" rx="3" fill="#1e3a5f" stroke="#60a5fa" strokeWidth="0.5" />

          {/* Second row */}
          <rect
            x="45"
            y="218"
            width="55"
            height="30"
            rx="3"
            fill="#1e3a5f"
            stroke="#a78bfa"
            strokeWidth="0.5"
            style={{ animation: "block-drop 2s ease-out 0.5s both" }}
          />
          <rect
            x="105"
            y="218"
            width="40"
            height="30"
            rx="3"
            fill="#1e3a5f"
            stroke="#a78bfa"
            strokeWidth="0.5"
            style={{ animation: "block-drop 2s ease-out 1s both" }}
          />

          {/* Third row */}
          <rect
            x="55"
            y="186"
            width="50"
            height="30"
            rx="3"
            fill="#1e3a5f"
            stroke="#34d399"
            strokeWidth="0.5"
            style={{ animation: "block-drop 2s ease-out 1.5s both" }}
          />

          {/* Top block - pulsing */}
          <rect
            x="62"
            y="154"
            width="36"
            height="30"
            rx="3"
            fill="#1e3a5f"
            stroke="#f59e0b"
            strokeWidth="0.5"
            style={{ animation: "block-drop 2s ease-out 2s both" }}
          />
        </g>

        {/* Spinning gear */}
        <g
          style={{
            transformOrigin: "160px 290px",
            animation: "gear-spin 6s linear infinite",
          }}
        >
          <circle cx="160" cy="290" r="15" fill="none" stroke="#475569" strokeWidth="3" />
          <circle cx="160" cy="290" r="5" fill="#475569" />
          {[0, 45, 90, 135].map((angle) => (
            <line
              key={angle}
              x1="160"
              y1="273"
              x2="160"
              y2="278"
              stroke="#475569"
              strokeWidth="3"
              strokeLinecap="round"
              transform={`rotate(${angle} 160 290)`}
            />
          ))}
        </g>

        {/* Ground line */}
        <line
          x1="10"
          y1="320"
          x2="190"
          y2="320"
          stroke="#334155"
          strokeWidth="2"
        />

        {/* Sparkle dots */}
        <circle
          cx="40"
          cy="160"
          r="2"
          fill="#60a5fa"
          style={{ animation: "pulse-glow 2s ease-in-out infinite" }}
        />
        <circle
          cx="150"
          cy="140"
          r="1.5"
          fill="#a78bfa"
          style={{
            animation: "pulse-glow 2s ease-in-out 0.7s infinite",
          }}
        />
        <circle
          cx="170"
          cy="200"
          r="1.5"
          fill="#34d399"
          style={{
            animation: "pulse-glow 2s ease-in-out 1.4s infinite",
          }}
        />
      </svg>
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
          style={{
            flexDirection: "row",
          }}
        >
          <Box visibleFrom="sm">
            <ConstructionAnimation />
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

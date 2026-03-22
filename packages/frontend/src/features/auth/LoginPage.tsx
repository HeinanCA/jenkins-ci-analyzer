import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Stack,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Alert,
  Card,
  Center,
  Container,
  Box,
} from "@mantine/core";
import { tigAuth, tigSetup, tigInstances } from "../../api/tig-client";
import { useAuthStore } from "../../store/auth-store";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const setInstanceId = useAuthStore((s) => s.setInstanceId);
  const setOrganizationId = useAuthStore((s) => s.setOrganizationId);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await tigAuth.signIn(email, password);

      if (result?.user) {
        setUser({
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        });

        // Load org + instance
        try {
          const setup = await tigSetup.getStatus();
          if (setup.organization) {
            setOrganizationId(setup.organization.id);
          }
          const instances = await tigInstances.list();
          if (instances.length > 0) {
            setInstanceId(instances[0].id);
          }
        } catch {
          // Non-critical — dashboard will handle missing data
        }

        navigate("/");
      } else {
        setError(result?.message ?? "Login failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

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
      <Container size="xs">
        <Card
          withBorder
          p="xl"
          radius="md"
          style={{
            backgroundColor: "rgba(255,255,255,0.03)",
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <Stack gap="md">
            <Stack align="center" gap="xs">
              <Title
                order={2}
                style={{
                  background:
                    "linear-gradient(135deg, #e2e8f0, #60a5fa, #a78bfa)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                PulsCI
              </Title>
              <Text size="sm" c="dimmed">
                Sign in to continue
              </Text>
            </Stack>

            {error && (
              <Alert color="red" variant="light">
                {error}
              </Alert>
            )}

            <TextInput
              label="Email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <PasswordInput
              label="Password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <Button fullWidth loading={loading} onClick={handleLogin}>
              Sign In
            </Button>
          </Stack>
        </Card>
      </Container>
    </Box>
  );
}

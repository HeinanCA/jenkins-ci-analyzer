import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { colors, cardStyle, metricStyle } from "../../theme/mantine-theme";
import {
  Stack,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Alert,
  Card,
  Container,
  Box,
} from "@mantine/core";
import { tigAuth, tigInstances } from "../../api/tig-client";
import { useAuthStore } from "../../store/auth-store";

const inputStyles = {
  input: {
    backgroundColor: "rgba(35, 38, 45, 0.6)",
    border: `1px solid ${colors.border}`,
    color: colors.text,
    "&::placeholder": { color: colors.textMuted },
    "&:focus": { borderColor: colors.accent },
  },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: 500 },
};

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const setInstanceId = useAuthStore((s) => s.setInstanceId);

  const loadOrgAndInstance = async () => {
    try {
      const instances = await tigInstances.list();
      if (instances.length > 0) {
        setInstanceId(instances[0].id);
        return true;
      }
    } catch {
      /* non-critical */
    }
    return false;
  };

  const handleSignIn = async () => {
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
        await loadOrgAndInstance();
        navigate("/");
      } else {
        setError(result?.message ?? "Invalid credentials");
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
        background: `radial-gradient(ellipse at top, ${colors.gradientEnd} 0%, ${colors.bg} 60%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Container size={420}>
        <Stack align="center" gap={4} mb="xl">
          <Title
            order={1}
            style={{
              ...metricStyle,
              fontSize: 36,
              background: colors.accentGradient,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            PulsCI
          </Title>
          <Text size="xs" c={colors.textMuted} fw={500}>
            CI/CD diagnostics by That Infrastructure Guy
          </Text>
        </Stack>

        <Card
          p={32}
          radius={12}
          style={{
            ...cardStyle,
            boxShadow:
              "0 8px 32px rgba(0, 0, 0, 0.5), 0 0 80px rgba(245, 103, 64, 0.03)",
          }}
        >
          <Stack gap="lg">
            <Box>
              <Text size="lg" fw={700} c={colors.text}>
                Welcome back
              </Text>
              <Text size="xs" c={colors.textTertiary} mt={4}>
                Sign in to your PulsCI account
              </Text>
            </Box>

            {error && (
              <Alert
                color="red"
                variant="light"
                styles={{
                  root: {
                    backgroundColor: "rgba(255, 107, 107, 0.08)",
                    border: `1px solid rgba(255, 107, 107, 0.2)`,
                  },
                  message: { color: colors.failure, fontSize: 13 },
                }}
              >
                {error}
              </Alert>
            )}

            <TextInput
              label="Email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
              styles={inputStyles}
            />
            <PasswordInput
              label="Password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
              styles={inputStyles}
            />
            <Button
              fullWidth
              loading={loading}
              onClick={handleSignIn}
              size="md"
              style={{
                background: colors.accentGradient,
                border: "none",
                fontWeight: 600,
              }}
            >
              Sign In
            </Button>
            <Text size="xs" c={colors.textMuted} ta="center">
              Need access? Contact your PulsCI admin.
            </Text>
          </Stack>
        </Card>
      </Container>
    </Box>
  );
}

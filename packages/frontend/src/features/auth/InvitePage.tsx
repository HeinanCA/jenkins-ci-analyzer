import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { tigInvitations } from "../../api/tig-client";

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

export function InvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    token ? null : "Invalid invitation link. No token provided.",
  );
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();

  const handleAccept = async () => {
    if (!token) return;

    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (password.length < 12) {
      setError("Password must be at least 12 characters");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await tigInvitations.accept(token, name.trim(), password);

      if (result?.error) {
        setError(result.error);
        return;
      }

      setSuccess(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to accept invitation",
      );
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
                You've been invited to PulsCI
              </Text>
              <Text size="xs" c={colors.textTertiary} mt={4}>
                Create your account to get started
              </Text>
            </Box>

            {error && (
              <Alert
                color="red"
                variant="light"
                styles={{
                  root: {
                    backgroundColor: "rgba(255, 107, 107, 0.08)",
                    border: "1px solid rgba(255, 107, 107, 0.2)",
                  },
                  message: { color: colors.failure, fontSize: 13 },
                }}
              >
                {error}
              </Alert>
            )}

            {success && (
              <Alert
                color="green"
                variant="light"
                styles={{
                  root: {
                    backgroundColor: "rgba(107, 255, 107, 0.08)",
                    border: "1px solid rgba(107, 255, 107, 0.2)",
                  },
                  message: { color: colors.success, fontSize: 13 },
                }}
              >
                Account created! Redirecting to login...
              </Alert>
            )}

            {!success && token && (
              <>
                <TextInput
                  label="Name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  styles={inputStyles}
                />
                <PasswordInput
                  label="Password"
                  placeholder="Choose a password (min 12 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAccept()}
                  styles={inputStyles}
                />
                <Button
                  fullWidth
                  loading={loading}
                  onClick={handleAccept}
                  size="md"
                  style={{
                    background: colors.accentGradient,
                    border: "none",
                    fontWeight: 600,
                  }}
                >
                  Create Account
                </Button>
              </>
            )}

            <Text size="xs" c={colors.textMuted} ta="center">
              Already have an account?{" "}
              <Text
                component="a"
                href="/login"
                size="xs"
                c={colors.accent}
                fw={600}
                style={{ textDecoration: "none" }}
              >
                Sign in
              </Text>
            </Text>
          </Stack>
        </Card>
      </Container>
    </Box>
  );
}

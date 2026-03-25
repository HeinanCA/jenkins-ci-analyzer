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
  Anchor,
} from "@mantine/core";
import { tigAuth, tigSetup, tigInstances } from "../../api/tig-client";
import { useAuthStore } from "../../store/auth-store";

type Mode = "signin" | "signup" | "setup";

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
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [jenkinsUrl, setJenkinsUrl] = useState("");
  const [jenkinsUser, setJenkinsUser] = useState("");
  const [jenkinsToken, setJenkinsToken] = useState("");
  const [orgName, setOrgName] = useState("");

  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const setInstanceId = useAuthStore((s) => s.setInstanceId);
  const setOrganizationId = useAuthStore((s) => s.setOrganizationId);

  const loadOrgAndInstance = async () => {
    try {
      const setup = await tigSetup.getStatus();
      if (setup.organization) setOrganizationId(setup.organization.id);
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
        const hasInstance = await loadOrgAndInstance();
        navigate(hasInstance ? "/" : "/");
        if (!hasInstance) setMode("setup");
      } else {
        setError(result?.message ?? "Invalid credentials");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("All fields are required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await tigAuth.signUp(email, password, name);
      if (result?.user) {
        setUser({
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        });
        setMode("setup");
      } else {
        setError(result?.message ?? "Sign up failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    if (
      !orgName.trim() ||
      !jenkinsUrl.trim() ||
      !jenkinsUser.trim() ||
      !jenkinsToken.trim()
    ) {
      setError("All fields are required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const orgResult = await tigSetup.create(orgName, email, name, password);
      if (orgResult?.organization) {
        setOrganizationId(orgResult.organization.id);
        const instance = await tigInstances.create(
          "Jenkins",
          jenkinsUrl,
          jenkinsUser,
          jenkinsToken,
          orgResult.organization.id,
        );
        if (instance?.id) {
          setInstanceId(instance.id);
          navigate("/");
          return;
        }
      }
      setError("Setup failed. Please check your details.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
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
        {/* Logo */}
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
            {/* Mode title */}
            <Box>
              <Text size="lg" fw={700} c={colors.text}>
                {mode === "signin"
                  ? "Welcome back"
                  : mode === "signup"
                    ? "Get started"
                    : "Connect Jenkins"}
              </Text>
              <Text size="xs" c={colors.textTertiary} mt={4}>
                {mode === "signin"
                  ? "Sign in to your PulsCI account"
                  : mode === "signup"
                    ? "Create your account to start diagnosing builds"
                    : "PulsCI needs access to analyze your build logs"}
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

            {mode === "signin" && (
              <>
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
                  Don't have an account?{" "}
                  <Anchor
                    size="xs"
                    c={colors.accent}
                    fw={600}
                    onClick={() => {
                      setError(null);
                      setMode("signup");
                    }}
                  >
                    Sign up
                  </Anchor>
                </Text>
              </>
            )}

            {mode === "signup" && (
              <>
                <TextInput
                  label="Name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  styles={inputStyles}
                />
                <TextInput
                  label="Email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  styles={inputStyles}
                />
                <PasswordInput
                  label="Password"
                  placeholder="Choose a password"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
                  styles={inputStyles}
                />
                <Button
                  fullWidth
                  loading={loading}
                  onClick={handleSignUp}
                  size="md"
                  style={{
                    background: colors.accentGradient,
                    border: "none",
                    fontWeight: 600,
                  }}
                >
                  Create Account
                </Button>
                <Text size="xs" c={colors.textMuted} ta="center">
                  Already have an account?{" "}
                  <Anchor
                    size="xs"
                    c={colors.accent}
                    fw={600}
                    onClick={() => {
                      setError(null);
                      setMode("signin");
                    }}
                  >
                    Sign in
                  </Anchor>
                </Text>
              </>
            )}

            {mode === "setup" && (
              <>
                <TextInput
                  label="Organization"
                  placeholder="e.g. Neteera"
                  value={orgName}
                  onChange={(e) => setOrgName(e.currentTarget.value)}
                  styles={inputStyles}
                />
                <Box
                  style={{
                    height: 1,
                    background: `linear-gradient(90deg, transparent, ${colors.border}, transparent)`,
                    margin: "4px 0",
                  }}
                />
                <TextInput
                  label="Jenkins URL"
                  placeholder="https://jenkins.yourcompany.com"
                  value={jenkinsUrl}
                  onChange={(e) => setJenkinsUrl(e.currentTarget.value)}
                  styles={inputStyles}
                />
                <TextInput
                  label="Username"
                  placeholder="Jenkins username"
                  value={jenkinsUser}
                  onChange={(e) => setJenkinsUser(e.currentTarget.value)}
                  styles={inputStyles}
                />
                <PasswordInput
                  label="API Token"
                  placeholder="Jenkins API token"
                  value={jenkinsToken}
                  onChange={(e) => setJenkinsToken(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSetup()}
                  styles={inputStyles}
                />
                <Button
                  fullWidth
                  loading={loading}
                  onClick={handleSetup}
                  size="md"
                  style={{
                    background: colors.accentGradient,
                    border: "none",
                    fontWeight: 600,
                  }}
                >
                  Connect & Start
                </Button>
                <Text size="xs" c={colors.textMuted} ta="center">
                  You can find your API token in Jenkins → Your Name → Configure
                  → API Token
                </Text>
              </>
            )}
          </Stack>
        </Card>
      </Container>
    </Box>
  );
}

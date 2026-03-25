import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { colors, cardStyle } from "../../theme/mantine-theme";
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
  Divider,
} from "@mantine/core";
import { tigAuth, tigSetup, tigInstances } from "../../api/tig-client";
import { useAuthStore } from "../../store/auth-store";

type Mode = "signin" | "signup" | "setup";

export function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Setup fields
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
      if (setup.organization) {
        setOrganizationId(setup.organization.id);
      }
      const instances = await tigInstances.list();
      if (instances.length > 0) {
        setInstanceId(instances[0].id);
        return true;
      }
    } catch {
      // Non-critical
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
        if (hasInstance) {
          navigate("/");
        } else {
          setMode("setup");
        }
      } else {
        setError(result?.message ?? "Login failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
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
        // New user — go to setup
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
    if (!orgName.trim() || !jenkinsUrl.trim() || !jenkinsUser.trim() || !jenkinsToken.trim()) {
      setError("All fields are required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Create org
      const orgResult = await tigSetup.create(orgName, email, name);
      if (orgResult?.organization) {
        setOrganizationId(orgResult.organization.id);

        // Create instance
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

  const subtitle =
    mode === "signin"
      ? "Sign in to continue"
      : mode === "signup"
        ? "Create your account"
        : "Connect your Jenkins instance";

  return (
    <Box
      mih="100vh"
      style={{
        background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.gradientMid} 50%, ${colors.gradientEnd} 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Container size="xs">
        <Card
          p="xl"
          radius="md"
          style={{
            ...cardStyle,
            boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)",
          }}
        >
          <Stack gap="md">
            <Stack align="center" gap="xs">
              <Title
                order={2}
                style={{
                  background: colors.accentGradient,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                PulsCI
              </Title>
              <Text size="sm" c={colors.textTertiary}>
                {subtitle}
              </Text>
            </Stack>

            {error && (
              <Alert color="red" variant="light">
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
                />
                <PasswordInput
                  label="Password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                />
                <Button fullWidth loading={loading} color="orange" onClick={handleSignIn}>
                  Sign In
                </Button>
                <Divider
                  label="or"
                  labelPosition="center"
                  styles={{ label: { color: colors.textMuted } }}
                />
                <Text size="xs" c={colors.textTertiary} ta="center">
                  Don't have an account?{" "}
                  <Anchor
                    size="xs"
                    c={colors.accent}
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
                />
                <TextInput
                  label="Email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                />
                <PasswordInput
                  label="Password"
                  placeholder="Choose a password"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
                />
                <Button fullWidth loading={loading} color="orange" onClick={handleSignUp}>
                  Create Account
                </Button>
                <Text size="xs" c={colors.textTertiary} ta="center">
                  Already have an account?{" "}
                  <Anchor
                    size="xs"
                    c={colors.accent}
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
                <Text size="xs" c={colors.textSecondary}>
                  Connect PulsCI to your Jenkins so we can start analyzing
                  your builds.
                </Text>
                <TextInput
                  label="Organization Name"
                  placeholder="e.g. Neteera"
                  value={orgName}
                  onChange={(e) => setOrgName(e.currentTarget.value)}
                />
                <Divider
                  label="Jenkins Connection"
                  labelPosition="center"
                  styles={{ label: { color: colors.textMuted } }}
                />
                <TextInput
                  label="Jenkins URL"
                  placeholder="https://jenkins.yourcompany.com"
                  value={jenkinsUrl}
                  onChange={(e) => setJenkinsUrl(e.currentTarget.value)}
                />
                <TextInput
                  label="Username"
                  placeholder="Jenkins username"
                  value={jenkinsUser}
                  onChange={(e) => setJenkinsUser(e.currentTarget.value)}
                />
                <PasswordInput
                  label="API Token"
                  placeholder="Jenkins API token"
                  value={jenkinsToken}
                  onChange={(e) => setJenkinsToken(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSetup()}
                />
                <Button fullWidth loading={loading} color="orange" onClick={handleSetup}>
                  Connect & Start
                </Button>
              </>
            )}
          </Stack>
        </Card>
      </Container>
    </Box>
  );
}

import type { FailurePattern } from './types';
import {
  extractJunitContext,
  extractTypeScriptContext,
  extractJestContext,
  extractSpringContext,
  extractNpmContext,
  extractGenericContext,
} from './context-extractors';

export const FAILURE_PATTERNS: readonly FailurePattern[] = [
  // ─── Infrastructure ─────────────────────────────────────────

  {
    id: 'oom',
    name: 'Out of Memory',
    category: 'infra',
    severity: 'critical',
    patterns: [
      /Cannot allocate memory/i,
      /exit code 137/i,
      /Java heap space/i,
      /OOMKilled/i,
      /OutOfMemoryError/i,
      /ENOMEM/i,
    ],
    description:
      'The build ran out of memory. This is typically an infrastructure issue.',
    remediationSteps: [
      'Check if your build has a memory leak (e.g., unbounded caching in tests).',
      'Increase memory allocation in your Jenkinsfile (e.g., -Xmx for Java builds).',
      'If this is a container build, increase the container memory limit.',
      'Contact DevOps if the issue persists across multiple jobs.',
    ],
    contextExtractor: extractGenericContext,
  },
  {
    id: 'timeout',
    name: 'Build Timeout',
    category: 'infra',
    severity: 'high',
    patterns: [
      /Timeout has been exceeded/i,
      /deadline exceeded/i,
      /timed out/i,
      /Build timed out/i,
      /Cancelling nested steps due to timeout/i,
    ],
    description:
      'The build exceeded its time limit.',
    remediationSteps: [
      'Check if a test is hanging or running much longer than usual.',
      'Look for infinite loops or unbounded retries in recently changed code.',
      'Verify that all external dependencies (databases, APIs) are reachable.',
      'If the build is legitimately slow, consider increasing the timeout.',
    ],
    contextExtractor: extractGenericContext,
  },
  {
    id: 'disk-full',
    name: 'Disk Space Exhausted',
    category: 'infra',
    severity: 'critical',
    patterns: [
      /No space left on device/i,
      /ENOSPC/i,
      /disk usage.*100%/i,
      /insufficient disk space/i,
    ],
    description:
      'The build agent ran out of disk space. This is an infrastructure issue — not your fault.',
    remediationSteps: [
      'This is an infrastructure issue. Your code is not at fault.',
      'The build agent needs disk cleanup or a larger disk.',
      'Contact DevOps to address the disk space issue.',
      'Your build will succeed once the agent has enough space — try re-running.',
    ],
  },
  {
    id: 'agent-disconnected',
    name: 'Agent Disconnected',
    category: 'infra',
    severity: 'critical',
    patterns: [
      /Agent\s+.*\s+is offline/i,
      /Connection was broken/i,
      /java\.nio\.channels\.ClosedChannelException/i,
      /Slave went offline/i,
      /hudson\.remoting/i,
    ],
    description:
      'The build agent disconnected during the build. Not your fault.',
    remediationSteps: [
      'This is an infrastructure issue. Your code is not at fault.',
      'Re-run the build. If it keeps happening, contact DevOps.',
      'Check the Health page to see if other agents are affected.',
    ],
  },
  {
    id: 'network',
    name: 'Network Failure',
    category: 'infra',
    severity: 'high',
    patterns: [
      /UnknownHostException/i,
      /Connection refused/i,
      /ETIMEDOUT/i,
      /SSL handshake/i,
      /ECONNRESET/i,
      /ENOTFOUND/i,
      /getaddrinfo/i,
    ],
    description:
      'A network connection failed during the build.',
    remediationSteps: [
      'Re-run the build — transient network issues often resolve themselves.',
      'Check if the failing host is a dependency your build needs.',
      'Check the Health page for infrastructure problems.',
      'Contact DevOps if a specific internal service is unreachable.',
    ],
    contextExtractor: extractGenericContext,
  },
  {
    id: 'permission',
    name: 'Permission Denied',
    category: 'infra',
    severity: 'high',
    patterns: [
      /Permission denied/i,
      /403 Forbidden/i,
      /Access Denied/i,
      /authentication required/i,
      /not authorized/i,
    ],
    description:
      'The build was denied access to a resource.',
    remediationSteps: [
      'Check if the build requires credentials that may have expired.',
      'Verify that your Jenkinsfile references the correct credentials ID.',
      'Contact DevOps if you believe your permissions should be granted.',
    ],
    contextExtractor: extractGenericContext,
  },
  {
    id: 'docker',
    name: 'Docker / Container Issue',
    category: 'infra',
    severity: 'high',
    patterns: [
      /Cannot connect to the Docker daemon/i,
      /image.*not found/i,
      /Error response from daemon/i,
      /docker:.*not found/i,
      /pull access denied/i,
    ],
    description:
      'A Docker-related error occurred.',
    remediationSteps: [
      'If "Cannot connect to Docker daemon" — this is an infra issue. Contact DevOps.',
      'If "image not found" — check the image name and tag in your Dockerfile.',
      'If "pull access denied" — ensure the build has credentials to pull from the registry.',
    ],
    contextExtractor: extractGenericContext,
  },
  {
    id: 'port-in-use',
    name: 'Port Already In Use',
    category: 'infra',
    severity: 'high',
    patterns: [
      /Address already in use/i,
      /BindException.*Address already in use/i,
      /EADDRINUSE/i,
    ],
    description:
      'A port needed by the build is already occupied. This is usually a CI infrastructure issue — parallel builds or a previous test didn\'t clean up.',
    remediationSteps: [
      'This is an infrastructure issue, not your code.',
      'Re-run the build — the port may be freed by then.',
      'If using integration tests, ensure they use random ports or Testcontainers.',
      'Contact DevOps if this happens consistently on the same agent.',
    ],
    contextExtractor: extractGenericContext,
  },

  // ─── Code: Tests ────────────────────────────────────────────

  {
    id: 'test-failure-junit',
    name: 'Test Failure (JUnit/Maven)',
    category: 'code',
    severity: 'medium',
    patterns: [
      /Tests run:.*Failures:\s*[1-9]/i,
      /<<< FAIL!/,
      /BUILD FAILURE.*There are test failures/i,
    ],
    description:
      'One or more JUnit tests failed.',
    remediationSteps: [
      'See the failing test and assertion details above.',
      'Run the failing test locally: `mvn test -pl <module> -Dtest=<TestClass>#<method>`',
      'Fix the test or the code it validates, then push again.',
    ],
    contextExtractor: extractJunitContext,
  },
  {
    id: 'test-failure-jest',
    name: 'Test Failure (Jest/Vitest)',
    category: 'code',
    severity: 'medium',
    patterns: [
      /FAIL\s+src\//,
      /Tests:\s+\d+\s+failed/i,
      /✕|✖/,
    ],
    description:
      'One or more JavaScript/TypeScript tests failed.',
    remediationSteps: [
      'See the failing test and assertion details above.',
      'Run the failing test locally: `npm test -- --testPathPattern=<file>`',
      'Fix the test or the code it validates, then push again.',
    ],
    contextExtractor: extractJestContext,
  },

  // ─── Code: Compilation ──────────────────────────────────────

  {
    id: 'compilation-ts',
    name: 'TypeScript Compilation Error',
    category: 'code',
    severity: 'high',
    patterns: [
      /error TS\d+/i,
      /Cannot find module.*\.tsx?/i,
    ],
    description:
      'TypeScript compilation failed.',
    remediationSteps: [
      'See the file, line, and error details above.',
      'Run locally: `npx tsc --noEmit`',
      'Check if a recent rename or deletion broke an import.',
    ],
    contextExtractor: extractTypeScriptContext,
  },
  {
    id: 'compilation-java',
    name: 'Java Compilation Error',
    category: 'code',
    severity: 'high',
    patterns: [
      /error:\s*cannot find symbol/i,
      /COMPILATION ERROR/i,
      /javac.*error/i,
    ],
    description:
      'Java compilation failed.',
    remediationSteps: [
      'See the file, line, and error details above.',
      'Run locally: `mvn compile -pl <module>`',
      'Check if a recent rename or deletion broke an import.',
    ],
    contextExtractor: extractGenericContext,
  },

  // ─── Code: Dependencies ─────────────────────────────────────

  {
    id: 'dependency-npm',
    name: 'npm Dependency Resolution Failed',
    category: 'code',
    severity: 'high',
    patterns: [
      /npm ERR! 404/i,
      /ERESOLVE/i,
      /peer dep/i,
      /Could not resolve dependency/i,
    ],
    description:
      'An npm dependency could not be resolved.',
    remediationSteps: [
      'See the conflicting package details above.',
      'Run `npm install` locally to reproduce.',
      'Check for conflicting peer dependency versions.',
      'If a private registry is down, this may be an infra issue.',
    ],
    contextExtractor: extractNpmContext,
  },
  {
    id: 'dependency-maven',
    name: 'Maven Dependency Resolution Failed',
    category: 'code',
    severity: 'high',
    patterns: [
      /Could not resolve dependencies/i,
      /Could not find artifact/i,
      /Non-resolvable parent POM/i,
    ],
    description:
      'A Maven dependency could not be resolved.',
    remediationSteps: [
      'Check if the failing artifact exists in your Maven repository.',
      'Run `mvn dependency:tree` locally to inspect the dependency tree.',
      'Check if a private Nexus/Artifactory is accessible.',
    ],
    contextExtractor: extractGenericContext,
  },

  // ─── Code: Spring-specific ──────────────────────────────────

  {
    id: 'spring-context',
    name: 'Spring Context Startup Failure',
    category: 'code',
    severity: 'high',
    patterns: [
      /BeanCreationException/i,
      /UnsatisfiedDependencyException/i,
      /NoSuchBeanDefinitionException/i,
      /ApplicationContext.*failed to start/i,
    ],
    description:
      'The Spring application context failed to start. A bean could not be created or a dependency could not be injected.',
    remediationSteps: [
      'See the failing bean and root cause above.',
      'Check if a required @Component, @Service, or @Repository is missing.',
      'Check if a configuration property is missing or has a wrong value.',
      'Run the failing test locally to see the full startup error.',
    ],
    contextExtractor: extractSpringContext,
  },
  {
    id: 'flyway',
    name: 'Database Migration Failed (Flyway)',
    category: 'code',
    severity: 'high',
    patterns: [
      /FlywayException/i,
      /Migration.*failed/i,
      /Flyway.*error/i,
    ],
    description:
      'A Flyway database migration failed. This is a schema issue, not a test issue.',
    remediationSteps: [
      'Check which migration version failed (see details above).',
      'Verify the SQL is correct against your target database.',
      'Check if the migration was already partially applied (may need manual rollback).',
      'Run `mvn flyway:info` to see migration status.',
    ],
    contextExtractor: extractGenericContext,
  },

  // ─── Code: Lint/Style ───────────────────────────────────────

  {
    id: 'lint',
    name: 'Lint / Style Violation',
    category: 'code',
    severity: 'low',
    patterns: [
      /eslint.*error/i,
      /checkstyle/i,
      /found\s+\d+\s+error/i,
      /flake8/i,
      /pylint/i,
      /prettier.*--check/i,
      /spotbugs/i,
    ],
    description:
      'Code style or linting checks failed.',
    remediationSteps: [
      'Run the linter locally (check your package.json or Makefile for the lint command).',
      'Many lint errors can be auto-fixed (e.g., `npm run lint -- --fix`).',
      'Fix remaining errors manually based on the error messages.',
    ],
    contextExtractor: extractGenericContext,
  },

  // ─── Code: SCM ──────────────────────────────────────────────

  {
    id: 'scm',
    name: 'SCM Checkout Failed',
    category: 'infra',
    severity: 'high',
    patterns: [
      /Failed to checkout/i,
      /fatal: repository.*not found/i,
      /Authentication failed for/i,
      /Could not read from remote repository/i,
    ],
    description:
      'Jenkins failed to check out the source code.',
    remediationSteps: [
      'Verify the repository URL is correct.',
      'Check if the Git credentials in Jenkins have expired.',
      'If the repo was recently renamed or moved, update the job configuration.',
      'Contact DevOps if this error started happening across multiple jobs.',
    ],
    contextExtractor: extractGenericContext,
  },
] as const;

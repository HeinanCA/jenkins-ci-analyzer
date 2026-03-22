/**
 * Strips KNOWN NOISE from build logs. Does NOT decide what's signal.
 * Everything that isn't provably noise passes through to the AI.
 *
 * Also calculates noise stats for user-facing insight.
 */

// Lines that are definitively noise — never diagnostic
const NOISE_PATTERNS = [
  /^\[INFO\] Downloading from/,
  /^\[INFO\] Downloaded from/,
  /^\[INFO\] Progress/,
  /^Downloading:/,
  /^Downloaded:/,
  /^\[INFO\]\s*$/,
  /^\[INFO\] ---.*---$/,
  /^\[INFO\] Building .* \[/,
  /^\[INFO\] Compiling \d+ source files/,
  /^\[INFO\] Nothing to compile/,
  /^\[INFO\] skip non existing resourceDirectory/,
  /^\[INFO\] Copying \d+ resource/,
  /^\[INFO\] Using.*defaults/,
  /^\[INFO\] No sources to compile/,
  /^\s*\[Pipeline\] (?:node|sh|echo|stage|{|}|\/\/)\s*$/,
  /^npm warn deprecated/,
  /^npm warn .*EBADENGINE/,
  /^npm warn .*optional dep/i,
  /^npm http fetch/,
  /^\s*added \d+ packages/,
  /^\s*\d+ packages are looking for funding/,
  /^#\d+\s+\[[\d/]+\]\s+(?:CACHED|DONE)/,
  /^#\d+\s+sha256:/,
  /^#\d+\s+[\d.]+[kMG]?B\s+\/\s+[\d.]+[kMG]?B/,
];

// Lines that appear in passing tests — noise when tests pass, keep when they fail
const PASSING_TEST_NOISE = [
  /^\[INFO\] Tests run: \d+, Failures: 0, Errors: 0/,
  /^\[INFO\] Running [\w.]+/,
];

export interface LogStats {
  readonly totalLines: number;
  readonly noiseLines: number;
  readonly signalLines: number;
  readonly noisePercent: number;
  readonly totalBytes: number;
  readonly signalBytes: number;
  readonly topNoiseCategory: string;
}

export interface FilteredLog {
  readonly text: string;
  readonly stats: LogStats;
}

export function filterLogForAnalysis(log: string): FilteredLog {
  const lines = log.split('\n');
  const kept: string[] = [];
  let noiseCount = 0;
  let mavenDownloads = 0;
  let pipelineNoise = 0;
  let npmNoise = 0;
  let dockerNoise = 0;

  for (const line of lines) {
    let isNoise = false;

    for (const pattern of NOISE_PATTERNS) {
      if (pattern.test(line)) {
        isNoise = true;
        // Categorize noise
        if (line.includes('Downloading') || line.includes('Downloaded')) mavenDownloads++;
        else if (line.includes('[Pipeline]')) pipelineNoise++;
        else if (line.includes('npm')) npmNoise++;
        else if (line.startsWith('#')) dockerNoise++;
        break;
      }
    }

    if (!isNoise) {
      // Check passing test noise
      for (const pattern of PASSING_TEST_NOISE) {
        if (pattern.test(line)) {
          isNoise = true;
          break;
        }
      }
    }

    if (isNoise) {
      noiseCount++;
    } else {
      kept.push(line);
    }
  }

  // Determine top noise category
  const categories = [
    { name: 'Maven dependency downloads', count: mavenDownloads },
    { name: 'Jenkins pipeline scaffolding', count: pipelineNoise },
    { name: 'npm install chatter', count: npmNoise },
    { name: 'Docker layer output', count: dockerNoise },
  ].filter((c) => c.count > 0);
  categories.sort((a, b) => b.count - a.count);
  const topCategory = categories[0]?.name ?? 'build tool verbosity';

  const signalText = kept.join('\n');
  const noisePercent = lines.length > 0
    ? Math.round((noiseCount / lines.length) * 100)
    : 0;

  return {
    text: signalText,
    stats: {
      totalLines: lines.length,
      noiseLines: noiseCount,
      signalLines: kept.length,
      noisePercent,
      totalBytes: log.length,
      signalBytes: signalText.length,
      topNoiseCategory: topCategory,
    },
  };
}

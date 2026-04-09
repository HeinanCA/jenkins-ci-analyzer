import { useCallback, useEffect, useState } from "react";
import {
  ActionIcon,
  Group,
  Text,
  TextInput,
  Tooltip,
  Transition,
} from "@mantine/core";
import { colors } from "../../../theme/mantine-theme";
import { tigFeedback } from "../../../api/tig-client";

type Rating = "helpful" | "not_helpful";

interface FeedbackState {
  readonly rating: Rating | null;
  readonly showNote: boolean;
  readonly note: string;
  readonly submitting: boolean;
}

const INITIAL_STATE: FeedbackState = {
  rating: null,
  showNote: false,
  note: "",
  submitting: false,
};

interface Props {
  readonly analysisId: string;
}

export function FeedbackButtons({ analysisId }: Props) {
  const [state, setState] = useState<FeedbackState>(INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;
    tigFeedback.get(analysisId).then((data) => {
      if (cancelled || !data) return;
      setState((prev) => ({
        ...prev,
        rating: data.rating as Rating,
        note: data.note ?? "",
      }));
    }).catch(() => {
      // Silently ignore — user just hasn't voted yet
    });
    return () => { cancelled = true; };
  }, [analysisId]);

  const handleVote = useCallback(
    async (rating: Rating) => {
      // Toggle off if same rating clicked again
      const newRating = state.rating === rating ? null : rating;

      if (newRating === "not_helpful") {
        setState((prev) => ({
          ...prev,
          rating: newRating,
          showNote: true,
          submitting: true,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          rating: newRating,
          showNote: false,
          note: "",
          submitting: true,
        }));
      }

      try {
        if (newRating) {
          await tigFeedback.submit(analysisId, newRating, state.note || undefined);
        } else {
          // Re-submit with current rating to effectively "unset" — but API requires a rating.
          // For now, treat clicking same button as a toggle: submit opposite then the original.
          // Actually, the API doesn't support delete. Just keep the last vote.
          // We'll submit the rating that was clicked (the "toggle off" is UI-only).
          await tigFeedback.submit(analysisId, rating);
        }
      } catch {
        // Revert on error
        setState((prev) => ({ ...prev, rating: state.rating }));
      } finally {
        setState((prev) => ({ ...prev, submitting: false }));
      }
    },
    [analysisId, state.rating, state.note],
  );

  const handleNoteSubmit = useCallback(async () => {
    if (!state.rating) return;
    setState((prev) => ({ ...prev, submitting: true }));
    try {
      await tigFeedback.submit(analysisId, state.rating, state.note || undefined);
    } catch {
      // Note failed to save — not critical
    } finally {
      setState((prev) => ({ ...prev, submitting: false, showNote: false }));
    }
  }, [analysisId, state.rating, state.note]);

  const isHelpful = state.rating === "helpful";
  const isNotHelpful = state.rating === "not_helpful";

  return (
    <Group gap={6} align="center">
      <Text size="xs" c={colors.textMuted}>
        Was this helpful?
      </Text>
      <Tooltip label="Helpful">
        <ActionIcon
          size="xs"
          variant={isHelpful ? "filled" : "subtle"}
          color={isHelpful ? colors.success : "gray"}
          onClick={() => handleVote("helpful")}
          disabled={state.submitting}
          aria-label="Mark as helpful"
        >
          <Text size="xs">&#128077;</Text>
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Not helpful">
        <ActionIcon
          size="xs"
          variant={isNotHelpful ? "filled" : "subtle"}
          color={isNotHelpful ? colors.failure : "gray"}
          onClick={() => handleVote("not_helpful")}
          disabled={state.submitting}
          aria-label="Mark as not helpful"
        >
          <Text size="xs">&#128078;</Text>
        </ActionIcon>
      </Tooltip>
      <Transition mounted={state.showNote} transition="slide-right" duration={200}>
        {(styles) => (
          <TextInput
            style={styles}
            size="xs"
            placeholder="What was wrong?"
            value={state.note}
            onChange={(e) =>
              setState((prev) => ({ ...prev, note: e.currentTarget.value }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNoteSubmit();
            }}
            onBlur={handleNoteSubmit}
            styles={{
              input: {
                backgroundColor: colors.surfaceLight,
                borderColor: colors.border,
                color: colors.text,
                fontSize: 11,
                height: 24,
                minHeight: 24,
                width: 160,
              },
            }}
          />
        )}
      </Transition>
    </Group>
  );
}

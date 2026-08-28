import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useVoiceInput } from "../useVoiceInput";

/**
 * Two real bugs, both reported as "it captured the first few seconds
 * then went blank":
 *
 *  1. onresult only reports results from event.resultIndex onward, so
 *     each callback carried just the newest segment. Assigning that
 *     straight to state overwrote everything said before.
 *
 *  2. Chrome ends recognition after a few seconds of silence even with
 *     continuous = true. onend treated that as "the user finished", so
 *     pausing to think submitted the sentence and stopped dictation.
 */

type Handlers = {
  onresult: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
};

class FakeRecognition implements Handlers {
  static last: FakeRecognition | null = null;

  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;

  startCalls = 0;
  stopCalls = 0;

  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    this.startCalls += 1;
  }
  stop() {
    this.stopCalls += 1;
  }

  /**
   * The browser passes the FULL results list every time, with
   * resultIndex pointing at the first new entry -- not just the new
   * segment. Interim results are replaced on the next event; finalised
   * ones stay.
   */
  private results: { 0: { transcript: string }; isFinal: boolean }[] = [];

  emit(segments: { text: string; final: boolean }[]) {
    // Drop any trailing interim result; the browser supersedes it.
    while (this.results.length && !this.results[this.results.length - 1].isFinal) {
      this.results.pop();
    }

    const resultIndex = this.results.length;
    for (const s of segments) {
      this.results.push({ 0: { transcript: s.text }, isFinal: s.final });
    }

    this.onresult?.({ resultIndex, results: this.results });
  }

  reset() {
    this.results = [];
  }
}

beforeEach(() => {
  FakeRecognition.last = null;
  (window as unknown as Record<string, unknown>).SpeechRecognition =
    FakeRecognition;
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  vi.restoreAllMocks();
});

function setup() {
  const onResult = vi.fn();
  const hook = renderHook(() => useVoiceInput({ onResult }));
  act(() => {
    hook.result.current.toggle();
  });
  return { onResult, hook, rec: () => FakeRecognition.last! };
}

describe("useVoiceInput dictation", () => {
  it("keeps earlier speech instead of overwriting it", () => {
    const { hook, rec } = setup();

    act(() => rec().emit([{ text: "plan a trip to Paris", final: true }]));
    act(() => rec().emit([{ text: " for five days", final: true }]));

    // Bug 1: the second batch used to replace the first.
    expect(hook.result.current.voice.interimTranscript).toBe(
      "plan a trip to Paris for five days",
    );
  });

  it("shows finalised text plus what is being said right now", () => {
    const { hook, rec } = setup();

    act(() => rec().emit([{ text: "plan a trip", final: true }]));
    act(() => rec().emit([{ text: " to Rome", final: false }]));

    expect(hook.result.current.voice.interimTranscript).toBe(
      "plan a trip to Rome",
    );
  });

  it("resumes when the browser stops on silence", () => {
    const { onResult, rec } = setup();
    expect(rec().startCalls).toBe(1);

    act(() => rec().emit([{ text: "plan a trip", final: true }]));
    // Chrome's silence timeout, not the user.
    act(() => rec().onend?.());

    // Bug 2: this used to submit and go idle mid-sentence.
    expect(rec().startCalls).toBe(2);
    expect(onResult).not.toHaveBeenCalled();
  });

  it("submits the whole transcript when the user stops", () => {
    const { onResult, hook, rec } = setup();

    act(() => rec().emit([{ text: "plan a trip to Paris", final: true }]));
    act(() => rec().onend?.());
    act(() => rec().emit([{ text: " next spring", final: true }]));

    act(() => hook.result.current.stop());
    act(() => rec().onend?.());

    expect(onResult).toHaveBeenCalledWith("plan a trip to Paris next spring");
  });

  it("does not resume after an error", () => {
    const { rec } = setup();
    act(() => rec().onerror?.({ error: "network" }));
    act(() => rec().onend?.());

    expect(rec().startCalls).toBe(1);
  });

  it("starts a new dictation with an empty transcript", () => {
    const { hook, rec } = setup();
    act(() => rec().emit([{ text: "first attempt", final: true }]));
    act(() => hook.result.current.stop());
    act(() => rec().onend?.());

    act(() => {
      hook.result.current.toggle();
    });
    act(() => rec().emit([{ text: "second attempt", final: true }]));

    expect(hook.result.current.voice.interimTranscript).toBe("second attempt");
  });
});

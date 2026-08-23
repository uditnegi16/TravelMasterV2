import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiPromptBox } from "../AiPromptBox";

/**
 * The input was a fixed min-h-[48px] that only scrolled inside itself:
 * a one-line message got a tall box, a long one got a cramped scroller.
 * It now grows to fit its content, capped so it can't eat the screen.
 */
describe("AiPromptBox auto-grow", () => {
  it("resizes the textarea to fit its content", () => {
    render(<AiPromptBox onSubmit={vi.fn()} />);
    const ta = screen.getByLabelText(/describe the trip/i) as HTMLTextAreaElement;

    // jsdom reports scrollHeight 0, so stub it to simulate real content.
    let fake = 24;
    Object.defineProperty(ta, "scrollHeight", { get: () => fake });

    fireEvent.change(ta, { target: { value: "short" } });
    const small = ta.style.height;

    fake = 72;
    fireEvent.change(ta, { target: { value: "a".repeat(400) } });
    const big = ta.style.height;

    expect(parseInt(small)).toBeLessThan(parseInt(big));
    expect(parseInt(big)).toBe(72);
  });

  it("does not scroll while the text fits", () => {
    render(<AiPromptBox onSubmit={vi.fn()} />);
    const ta = screen.getByLabelText(/describe the trip/i) as HTMLTextAreaElement;
    Object.defineProperty(ta, "scrollHeight", { get: () => 48 });
    fireEvent.change(ta, { target: { value: "two\nlines" } });
    expect(ta.style.overflowY).toBe("hidden");
  });

  it("caps height and starts scrolling past five lines", () => {
    render(<AiPromptBox onSubmit={vi.fn()} />);
    const ta = screen.getByLabelText(/describe the trip/i) as HTMLTextAreaElement;
    Object.defineProperty(ta, "scrollHeight", { get: () => 5000 });
    fireEvent.change(ta, { target: { value: "x".repeat(9000) } });

    // jsdom reports lineHeight "normal" and no padding, so the fallback
    // of 24px per row applies: 5 rows = 120px.
    expect(parseInt(ta.style.height)).toBe(120);
    expect(ta.style.overflowY).toBe("auto");
  });
});

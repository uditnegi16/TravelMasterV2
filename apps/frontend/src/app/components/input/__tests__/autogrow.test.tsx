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

    fake = 120;
    fireEvent.change(ta, { target: { value: "a".repeat(400) } });
    const big = ta.style.height;

    expect(parseInt(small)).toBeLessThan(parseInt(big));
    expect(parseInt(big)).toBe(120);
  });

  it("caps growth at 180px", () => {
    render(<AiPromptBox onSubmit={vi.fn()} />);
    const ta = screen.getByLabelText(/describe the trip/i) as HTMLTextAreaElement;
    Object.defineProperty(ta, "scrollHeight", { get: () => 5000 });
    fireEvent.change(ta, { target: { value: "x".repeat(9000) } });
    expect(parseInt(ta.style.height)).toBe(180);
  });
});

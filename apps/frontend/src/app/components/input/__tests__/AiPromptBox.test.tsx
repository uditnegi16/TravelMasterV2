import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { AiPromptBox } from "../AiPromptBox";

describe("AiPromptBox", () => {
  it("has no axe accessibility violations", async () => {
    const { container } = render(<AiPromptBox />);
    const results = await axe(container);
    // Asserting directly on the real violations array rather than
    // vitest-axe's own toHaveNoViolations matcher -- that matcher's
    // type export is broken in the installed version (0.1.0; also
    // confirmed its extend-expect.js ships as an empty file). Real
    // axe-core results, just without the buggy convenience wrapper.
    expect(results.violations).toEqual([]);
  });

  it("exposes the prompt textbox by an accessible name, not placeholder alone", () => {
    // Issue 10 (Critical Product and TDD Backlog): "The main prompt
    // textarea relies on placeholder text instead of an associated
    // label." Testing by accessible role+name (not placeholder text)
    // is exactly how a screen reader user would locate this field --
    // if this only passes because of the placeholder, that's the bug.
    render(<AiPromptBox />);
    const textbox = screen.getByRole("textbox", { name: /trip|plan|describe/i });
    expect(textbox).toBeInTheDocument();
  });

  it("submits the trimmed value and clears the input", async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AiPromptBox onSubmit={handleSubmit} />);

    const textbox = screen.getByRole("textbox", { name: /trip|plan|describe/i });
    fireEvent.change(textbox, { target: { value: "  Plan a trip to Goa  " } });
    fireEvent.submit(textbox.closest("form")!);

    expect(handleSubmit).toHaveBeenCalledWith("Plan a trip to Goa");
  });

  it("does not submit an empty or whitespace-only prompt", () => {
    const handleSubmit = vi.fn();
    render(<AiPromptBox onSubmit={handleSubmit} />);

    const textbox = screen.getByRole("textbox", { name: /trip|plan|describe/i });
    fireEvent.change(textbox, { target: { value: "   " } });
    fireEvent.submit(textbox.closest("form")!);

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("guards against a double submit while the previous one is in flight", async () => {
    let resolveSubmit: () => void;
    const handleSubmit = vi.fn(
      () => new Promise<void>((resolve) => { resolveSubmit = resolve; })
    );
    render(<AiPromptBox onSubmit={handleSubmit} />);

    const textbox = screen.getByRole("textbox", { name: /trip|plan|describe/i });
    fireEvent.change(textbox, { target: { value: "Plan a trip" } });
    const form = textbox.closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form); // fired again before the first resolves

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    resolveSubmit!();
  });
});

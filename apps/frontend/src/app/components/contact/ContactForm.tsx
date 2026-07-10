import { useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Loader2, Send } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../../lib/cn";

interface FormValues {
  name: string;
  email: string;
  subject: string;
  message: string;
}

type Status = "idle" | "submitting" | "success" | "error";

const initialValues: FormValues = { name: "", email: "", subject: "", message: "" };

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function ContactForm({
  onSubmit,
}: {
  /** Wire this to your API call — throw to trigger the error state. */
  onSubmit?: (values: FormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<Partial<FormValues>>({});
  const [status, setStatus] = useState<Status>("idle");

  function update<K extends keyof FormValues>(key: K, val: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  function validate(): boolean {
    const next: Partial<FormValues> = {};
    if (!values.name.trim()) next.name = "Please enter your name.";
    if (!values.email.trim()) next.email = "Please enter your email.";
    else if (!isValidEmail(values.email)) next.email = "That email doesn't look right.";
    if (!values.subject.trim()) next.subject = "Please add a subject.";
    if (!values.message.trim() || values.message.trim().length < 10)
      next.message = "Tell us a bit more (at least 10 characters).";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setStatus("submitting");
    try {
      await onSubmit?.(values);
      setStatus("success");
      setValues(initialValues);
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="card-surface flex flex-col items-center px-8 py-14 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-greenSoft text-accent-green">
          <CheckCircle2 className="h-7 w-7" strokeWidth={2} />
        </span>
        <h3 className="mt-5 font-display text-xl font-bold text-ink">
          Message sent
        </h3>
        <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-ink-muted">
          Thanks for reaching out — we'll get back to you at your email
          address within 24 hours.
        </p>
        <Button variant="outline" size="md" className="mt-6" onClick={() => setStatus("idle")}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="card-surface p-6 md:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" error={errors.name}>
          <input
            type="text"
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Jordan Lee"
            className={inputClass(!!errors.name)}
          />
        </Field>

        <Field label="Email" error={errors.email}>
          <input
            type="email"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="you@example.com"
            className={inputClass(!!errors.email)}
          />
        </Field>
      </div>

      <div className="mt-5">
        <Field label="Subject" error={errors.subject}>
          <input
            type="text"
            value={values.subject}
            onChange={(e) => update("subject", e.target.value)}
            placeholder="How can we help?"
            className={inputClass(!!errors.subject)}
          />
        </Field>
      </div>

      <div className="mt-5">
        <Field label="Message" error={errors.message}>
          <textarea
            value={values.message}
            onChange={(e) => update("message", e.target.value)}
            placeholder="Tell us what's on your mind..."
            rows={5}
            className={cn(inputClass(!!errors.message), "resize-none")}
          />
        </Field>
      </div>

      {status === "error" && (
        <div className="mt-5 flex items-center gap-2 rounded-xl bg-accent-redSoft px-4 py-3 text-sm text-accent-red">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Something went wrong sending your message. Please try again.
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        className="mt-6"
        disabled={status === "submitting"}
        icon={
          status === "submitting" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )
        }
      >
        {status === "submitting" ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}

function inputClass(hasError: boolean) {
  return cn(
    "input-surface w-full px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none",
    hasError && "border-accent-red focus-within:border-accent-red"
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {error && <span className="mt-1.5 block text-xs text-accent-red">{error}</span>}
    </label>
  );
}

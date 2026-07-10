import { ErrorState } from "../components/states/ErrorState";

export default function ErrorPage() {
  return <ErrorState fullPage onRetry={() => window.location.reload()} />;
}

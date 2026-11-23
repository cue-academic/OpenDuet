import { createFileRoute } from "@tanstack/react-router";

// The shell keeps the conversation mounted as study screens open alongside it.
export const Route = createFileRoute("/_authed/_app/chat")({
  component: () => null,
});

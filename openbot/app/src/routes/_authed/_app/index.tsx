import { createFileRoute } from "@tanstack/react-router";
import { TodayScreen } from "@/components/shell/today-screen";

export const Route = createFileRoute("/_authed/_app/")({
  component: TodayScreen,
});

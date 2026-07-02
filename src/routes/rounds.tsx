import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/rounds")({
  component: () => <Outlet />,
});
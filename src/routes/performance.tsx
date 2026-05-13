import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/performance')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/performance"!</div>
}

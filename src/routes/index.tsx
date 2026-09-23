import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: RootIndexRedirect,
})

function RootIndexRedirect() {
  return <Navigate to="/projects" replace />
}

import { createLazyFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Editor } from '@/features/editor/components/editor'
import { useProjectStore } from '@/features/projects/stores/project-store'

export const Route = createLazyFileRoute('/editor/$projectId')({
  component: EditorPage,
})

function EditorPage() {
  const { projectId } = Route.useParams()
  const { project, migration } = Route.useLoaderData()

  useEffect(() => {
    useProjectStore.getState().setOpeningProjectId(null)
  }, [])

  return <Editor projectId={projectId} project={project} migration={migration} />
}

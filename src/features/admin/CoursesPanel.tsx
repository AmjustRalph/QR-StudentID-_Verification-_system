import { useState } from 'react'
import type { FormEvent } from 'react'
import { Card, CardHeader, EmptyState } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { supabase, friendlyError } from '@/lib/supabase'
import { useAllCourses } from './useAllCourses'

/** Admin course setup: list existing courses, add a new one by name/code. */
export function CoursesPanel() {
  const courses = useAllCourses()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!code.trim() || !name.trim()) {
      setError('Enter both a course code and a course name.')
      return
    }

    setSubmitting(true)
    const { error: insertError } = await supabase
      .from('courses')
      .insert({ code: code.trim().toUpperCase(), name: name.trim(), lecturer_id: null })
    setSubmitting(false)

    if (insertError) {
      setError(friendlyError(insertError))
      return
    }
    setCode('')
    setName('')
    courses.reload()
  }

  return (
    <Card flush>
      <CardHeader title={`Courses (${courses.data?.length ?? 0})`} />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-end">
        {error && (
          <div className="sm:w-full">
            <Alert tone="denied">{error}</Alert>
          </div>
        )}
        <Field
          label="Code"
          placeholder="e.g. IT301"
          className="uppercase sm:w-32"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <Field
          label="Course Name"
          placeholder="e.g. Mobile Application Development"
          className="sm:flex-1"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit" loading={submitting} className="sm:w-auto">
          Add Course
        </Button>
      </form>

      {courses.loading ? (
        <div className="grid h-24 place-items-center text-azure-600">
          <Spinner className="h-5 w-5" />
        </div>
      ) : courses.error ? (
        <div className="p-5">
          <Alert tone="denied">{courses.error}</Alert>
        </div>
      ) : courses.data && courses.data.length > 0 ? (
        <ul className="max-h-56 overflow-y-auto">
          {courses.data.map((course) => (
            <li key={course.id} className="flex items-center justify-between gap-3 border-b border-line px-5 py-2.5 last:border-0">
              <p className="min-w-0 truncate font-medium text-navy-900">{course.name}</p>
              <p className="data shrink-0 text-xs text-ink-muted">{course.code}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No courses yet" description="Add the first one above." />
      )}
    </Card>
  )
}

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Bell,
  CalendarClock,
  Cake,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  CircleDollarSign,
  Copy,
  Package,
  ListChecks,
  Mail,
  Megaphone,
  Pencil,
  Plane,
  PlayCircle,
  Plus,
  Save,
  ScrollText,
  Trash2,
  UserPlus,
  Workflow,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { notify } from '@/lib/notify'
import { useTranslations } from 'next-intl'
import {
  duplicateWorkflowAction,
  deleteWorkflowAction,
  saveWorkflowAction,
  testWorkflowAction,
} from '@/lib/actions/workflows'
import {
  WORKFLOW_ACTION_DEFINITIONS,
  WORKFLOW_CONDITION_OPERATORS,
  WORKFLOW_RECIPIENT_DEFINITIONS,
  WORKFLOW_TRIGGER_TYPES,
  getWorkflowSamplePayload,
  getWorkflowTriggerDefinition,
  normalizeWorkflowActions,
  normalizeWorkflowConditions,
} from '@/lib/workflow-definitions'
import type { getWorkflowAdminData } from '@/lib/workflows'
import type { WorkflowPreviewResult } from '@/lib/workflows'
import type {
  WorkflowAction,
  WorkflowCondition,
  WorkflowConditionOperator,
  WorkflowRecipientSelector,
} from '@/db/schema'

type WorkflowAdminData = Awaited<ReturnType<typeof getWorkflowAdminData>>
type WorkflowRow = WorkflowAdminData['workflows'][number]
type Option = { id: string; label: string }
type SelectedBlock = 'trigger' | 'conditions' | `action-${number}`

const defaultCondition: WorkflowCondition = { field: 'title', operator: 'contains', value: '' }
const defaultAction: WorkflowAction = {
  type: 'sendNotification',
  title: '{{title}}',
  message: '',
  recipients: [{ type: 'eventRecipients' }],
}

export function WorkflowSettingsForm({ data }: { data: WorkflowAdminData }) {
  const t = useTranslations('settings.workflowsPage')

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Button asChild>
          <Link href="/settings/workflows/new">
            <Plus className="size-4" />
            {t('newWorkflow')}
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="flows" className="w-full space-y-4">
        <TabsList>
          <TabsTrigger value="flows">{t('tabs.flows')}</TabsTrigger>
          <TabsTrigger value="activity">{t('tabs.activity')}</TabsTrigger>
        </TabsList>
        <TabsContent value="flows" className="w-full space-y-4">
          <WorkflowList workflows={data.workflows} />
        </TabsContent>
        <TabsContent value="activity" className="w-full space-y-4">
          <WorkflowActivity data={data} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function WorkflowList({ workflows }: { workflows: WorkflowRow[] }) {
  const t = useTranslations('settings.workflowsPage')
  const commonT = useTranslations('common')

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base">{t('existingWorkflows')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {workflows.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-md border border-dashed p-6 text-center">
            <Workflow className="size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">{t('empty.title')}</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {t('empty.description')}
            </p>
            <Button asChild className="mt-4">
              <Link href="/settings/workflows/new">
                <Plus className="size-4" />
                {t('newWorkflow')}
              </Link>
            </Button>
          </div>
        ) : workflows.map((workflow) => (
          <div
            key={workflow.id}
            className="grid gap-3 rounded-md border p-3 lg:grid-cols-[1fr_auto]"
          >
            <Link href={`/settings/workflows/${workflow.id}/edit`} className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{workflow.name}</p>
                <Badge variant={workflow.enabled ? 'default' : 'secondary'}>
                  {workflow.enabled ? commonT('enabled') : commonT('disabled')}
                </Badge>
                {workflow.lastRun && <RunBadge status={workflow.lastRun.status} />}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatWorkflowSummary(workflow, t)}
              </p>
            </Link>
            <div className="flex items-center gap-2 justify-self-start lg:justify-self-end">
              <Button asChild size="icon" variant="outline" aria-label={t('actions.editWorkflow')}>
                <Link href={`/settings/workflows/${workflow.id}/edit`}>
                  <Pencil className="size-4" />
                </Link>
              </Button>
              <WorkflowButton
                action={duplicateWorkflowAction}
                id={workflow.id}
                label={t('actions.duplicateWorkflow')}
                icon={<Copy className="size-4" />}
              />
              <WorkflowButton
                action={deleteWorkflowAction}
                id={workflow.id}
                label={t('actions.deleteWorkflow')}
                icon={<Trash2 className="size-4" />}
                destructive
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function WorkflowActivity({ data }: { data: WorkflowAdminData }) {
  const t = useTranslations('settings.workflowsPage')
  const workflowsById = new Map(data.workflows.map((workflow) => [workflow.id, workflow]))

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4" />
          {t('activity.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('activity.empty')}</p>
        ) : (
          data.runs.map((run) => {
            const workflow = workflowsById.get(run.workflowId)
            return (
              <div key={run.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{workflow?.name || t('activity.deletedWorkflow')}</p>
                    <RunBadge status={run.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {workflow?.triggerLabel || run.sourceType} · {run.sourceType} #{run.sourceId}
                  </p>
                  {run.error && <p className="mt-1 text-sm text-destructive">{run.error}</p>}
                </div>
                <span className="text-sm text-muted-foreground">
                  {new Date(run.startedAt).toLocaleString()}
                </span>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

export function WorkflowEditor({
  data,
  workflow,
}: {
  data: WorkflowAdminData
  workflow?: WorkflowRow | null
}) {
  const router = useRouter()
  const t = useTranslations('settings.workflowsPage')
  const commonT = useTranslations('common')
  const [name, setName] = React.useState(workflow?.name || '')
  const [enabled, setEnabled] = React.useState(workflow?.enabled ?? true)
  const [triggerType, setTriggerType] = React.useState(workflow?.triggerType || '')
  const [conditions, setConditions] = React.useState<WorkflowCondition[]>(
    workflow ? normalizeWorkflowConditions(workflow.conditions) : [],
  )
  const [actions, setActions] = React.useState<WorkflowAction[]>(
    workflow ? normalizeWorkflowActions(workflow.actions) : [defaultAction],
  )
  const previousTriggerType = React.useRef(triggerType)
  const [selectedBlock, setSelectedBlock] = React.useState<SelectedBlock>('trigger')
  const [testOpen, setTestOpen] = React.useState(false)
  const [samplePayload, setSamplePayload] = React.useState(() => getWorkflowSamplePayload(triggerType))
  const [previewResult, setPreviewResult] = React.useState<WorkflowPreviewResult | null>(null)
  const [pendingHref, setPendingHref] = React.useState<string | null>(null)
  const [isPending, startTransition] = React.useTransition()
  const [isTesting, startTestTransition] = React.useTransition()
  const trigger = triggerType ? getWorkflowTriggerDefinition(triggerType) : null
  const workflowId = workflow?.id || ''
  const initialState = React.useMemo(
    () =>
      serializeWorkflowState({
        name: workflow?.name || '',
        enabled: workflow?.enabled ?? true,
        triggerType: workflow?.triggerType || '',
        conditions: workflow ? normalizeWorkflowConditions(workflow.conditions) : [],
        actions: workflow ? normalizeWorkflowActions(workflow.actions) : [defaultAction],
      }),
    [workflow],
  )
  const currentState = React.useMemo(
    () => serializeWorkflowState({ name, enabled, triggerType, conditions, actions }),
    [actions, conditions, enabled, name, triggerType],
  )
  const isDirty = currentState !== initialState

  React.useEffect(() => {
    setSamplePayload(getWorkflowSamplePayload(triggerType))
    setPreviewResult(null)
  }, [triggerType])

  React.useEffect(() => {
    const previous = previousTriggerType.current
    previousTriggerType.current = triggerType
    if (!triggerType || previous === triggerType) return

    setActions((items) => items.map((action) => mergeSuggestedActionText(action, previous, triggerType, t)))
  }, [t, triggerType])

  React.useEffect(() => {
    if (!isDirty) return

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  React.useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!isDirty) return
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }

      const target = event.target instanceof Element ? event.target : null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return

      const nextUrl = new URL(anchor.href, window.location.href)
      if (nextUrl.origin !== window.location.origin) return
      const nextHref = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
      const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (nextHref === currentHref) return

      event.preventDefault()
      setPendingHref(nextHref)
    }

    document.addEventListener('click', handleDocumentClick, true)
    return () => document.removeEventListener('click', handleDocumentClick, true)
  }, [isDirty])

  function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await saveWorkflowAction(formData)
        notify.success(t('notices.saved'))
        router.push('/settings/workflows')
      } catch (error) {
        notify.error(error, t('notices.saveFailed'))
      }
    })
  }

  function saveCurrentWorkflow(navigateTo?: string) {
    startTransition(async () => {
      try {
        await saveWorkflowAction(
          buildWorkflowFormData({
            id: workflowId,
            name,
            enabled,
            triggerType,
            conditions,
            actions,
            samplePayload,
          }),
        )
        notify.success(t('notices.saved'))
        router.push(navigateTo || '/settings/workflows')
      } catch (error) {
        notify.error(error, t('notices.saveFailed'))
      }
    })
  }

  function addAction() {
    setActions((items) => {
      const next = [...items, defaultAction]
      setSelectedBlock(`action-${next.length - 1}`)
      return next
    })
  }

  function removeAction(index: number) {
    setActions((items) => items.filter((_, itemIndex) => itemIndex !== index))
    setSelectedBlock('trigger')
  }

  function runPreview() {
    if (!triggerType) {
      notify.error(t('notices.chooseStarterBeforeTesting'))
      setSelectedBlock('trigger')
      return
    }

    startTestTransition(async () => {
      try {
        const result = await testWorkflowAction(
          buildWorkflowFormData({
            id: workflowId,
            name,
            enabled,
            triggerType,
            conditions,
            actions,
            samplePayload,
          }),
        )
        setPreviewResult(result)
        if (result.status === 'failed') {
          notify.error(result.error || t('notices.previewFailed'))
        } else {
          notify.success(t('notices.previewReady'))
        }
      } catch (error) {
        notify.error(error, t('notices.previewFailed'))
      }
    })
  }

  return (
    <form action={submit} className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      {workflow && <input type="hidden" name="id" value={workflow.id} />}
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="triggerType" value={triggerType} />
      {enabled && <input type="hidden" name="enabled" value="on" />}
      {conditions.map((condition, index) => (
        <React.Fragment key={`condition-hidden-${index}`}>
          <input type="hidden" name={`conditions[${index}][field]`} value={condition.field} />
          <input type="hidden" name={`conditions[${index}][operator]`} value={condition.operator} />
          <input type="hidden" name={`conditions[${index}][value]`} value={condition.value || ''} />
        </React.Fragment>
      ))}
      {actions.map((action, index) => {
        const recipient = action.recipients?.[0] || { type: 'eventRecipients' as const }
        return (
          <React.Fragment key={`action-hidden-${index}`}>
            <input type="hidden" name={`actions[${index}][type]`} value={action.type} />
            <input type="hidden" name={`actions[${index}][title]`} value={action.title || ''} />
            <input type="hidden" name={`actions[${index}][message]`} value={action.message || ''} />
            <input type="hidden" name={`actions[${index}][body]`} value={action.body || ''} />
            <input type="hidden" name={`actions[${index}][categoryId]`} value={action.categoryId || ''} />
            <input type="hidden" name={`actions[${index}][recipientTypes]`} value={recipient.type} />
            {(recipient.userIds || []).map((id) => (
              <input key={`action-${index}-user-${id}`} type="hidden" name={`actions[${index}][userIds]`} value={id} />
            ))}
            {(recipient.roleIds || []).map((id) => (
              <input key={`action-${index}-role-${id}`} type="hidden" name={`actions[${index}][roleIds]`} value={id} />
            ))}
            {(recipient.departmentIds || []).map((id) => (
              <input key={`action-${index}-department-${id}`} type="hidden" name={`actions[${index}][departmentIds]`} value={id} />
            ))}
          </React.Fragment>
        )
      })}

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button asChild type="button" variant="ghost" size="icon" aria-label={t('actions.backToWorkflows')}>
            <Link href="/settings/workflows">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('untitledWorkflow')}
            className="h-9 w-full max-w-[720px] border-0 bg-muted/50 text-base font-semibold shadow-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={openTestRun}>
            <PlayCircle className="size-4" />
            {t('testRun.button')}
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            {commonT('enabled')}
          </label>
          <Button type="submit" disabled={isPending}>
            <Save className="size-4" />
            {isPending ? commonT('saving') : commonT('save')}
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden rounded-md bg-muted/40 p-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-h-0 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-2xl flex-col justify-center gap-4 py-4">
          <FlowSection label={t('sections.starter')}>
            <FlowBlock
              active={selectedBlock === 'trigger'}
              icon={<Workflow className="size-5" />}
              title={trigger ? getTranslatedTriggerLabel(trigger.type, trigger.label, t) : t('panels.chooseStarter')}
              subtitle={trigger ? t('blocks.eventStartsWorkflow') : t('blocks.noStarterSelected')}
              onClick={() => setSelectedBlock('trigger')}
            />
          </FlowSection>

          <FlowSection label={t('sections.conditions')}>
            <FlowBlock
              active={selectedBlock === 'conditions'}
              disabled={!triggerType}
              icon={<ListChecks className="size-5" />}
              title={
                conditions.length > 0
                  ? t('blocks.conditionCount', { count: conditions.length })
                  : t('blocks.noConditions')
              }
              subtitle={t('blocks.allConditionsMustMatch')}
              onClick={() => setSelectedBlock('conditions')}
            />
          </FlowSection>

          <FlowSection label={t('sections.actions')}>
            <div className="space-y-3">
              {actions.map((action, index) => (
                <FlowBlock
                  key={index}
                  active={selectedBlock === `action-${index}`}
                  disabled={!triggerType}
                  icon={getActionIcon(action.type)}
                  title={getTranslatedActionLabel(action.type, t)}
                  subtitle={action.title || action.message || action.body || t('blocks.configureThisAction')}
                  onClick={() => setSelectedBlock(`action-${index}`)}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={addAction}
                disabled={!triggerType}
              >
                <Plus className="size-4" />
                {t('actions.addAction')}
              </Button>
            </div>
          </FlowSection>
        </div>
        </div>

        <BuilderOptionsPanel
          selectedBlock={selectedBlock}
          triggerType={triggerType}
          triggerFields={trigger?.fields || []}
          conditions={conditions}
          actions={actions}
          options={data.options}
          onTriggerChange={setTriggerType}
          onConditionsChange={setConditions}
          onActionChange={(index, action) =>
            setActions((items) => items.map((item, itemIndex) => (itemIndex === index ? action : item)))
          }
          onActionRemove={removeAction}
        />
      </div>

      <WorkflowTestDialog
        open={testOpen}
        onOpenChange={(open) => {
          if (open) {
            resetTestRun()
            setTestOpen(true)
          } else {
            setTestOpen(false)
            resetTestRun()
          }
        }}
        triggerLabel={trigger ? getTranslatedTriggerLabel(trigger.type, trigger.label, t) : triggerType}
        triggerFields={trigger?.fields || []}
        users={data.options.users}
        conditions={conditions}
        actions={actions}
        samplePayload={samplePayload}
        onSamplePayloadChange={(updater) => {
          setSamplePayload(updater)
          setPreviewResult(null)
        }}
        result={previewResult}
        isTesting={isTesting}
        onRunPreview={runPreview}
      />
      <AlertDialog open={Boolean(pendingHref)} onOpenChange={(open) => !open && setPendingHref(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('unsaved.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('unsaved.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={isPending}>{commonT('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                const href = pendingHref
                setPendingHref(null)
                if (href) router.push(href)
              }}
            >
              {t('unsaved.discard')}
            </AlertDialogAction>
            <AlertDialogAction
              type="button"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault()
                const href = pendingHref
                setPendingHref(null)
                saveCurrentWorkflow(href || undefined)
              }}
            >
              {commonT('save')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )

  function openTestRun() {
    if (!triggerType) {
      notify.error(t('notices.chooseStarterBeforeTesting'))
      setSelectedBlock('trigger')
      return
    }
    resetTestRun()
    setTestOpen(true)
  }

  function resetTestRun() {
    setSamplePayload(getWorkflowSamplePayload(triggerType))
    setPreviewResult(null)
  }
}

function buildWorkflowFormData({
  id,
  name,
  enabled,
  triggerType,
  conditions,
  actions,
  samplePayload,
}: {
  id?: string
  name: string
  enabled: boolean
  triggerType: string
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  samplePayload: Record<string, string>
}) {
  const formData = new FormData()
  if (id) formData.set('id', id)
  formData.set('name', name)
  formData.set('triggerType', triggerType)
  if (enabled) formData.set('enabled', 'on')

  conditions.forEach((condition, index) => {
    formData.set(`conditions[${index}][field]`, condition.field)
    formData.set(`conditions[${index}][operator]`, condition.operator)
    formData.set(`conditions[${index}][value]`, condition.value || '')
  })

  actions.forEach((action, index) => {
    const recipient = action.recipients?.[0] || { type: 'eventRecipients' as const }
    formData.set(`actions[${index}][type]`, action.type)
    formData.set(`actions[${index}][title]`, action.title || '')
    formData.set(`actions[${index}][message]`, action.message || '')
    formData.set(`actions[${index}][body]`, action.body || '')
    formData.set(`actions[${index}][categoryId]`, action.categoryId || '')
    formData.set(`actions[${index}][recipientTypes]`, recipient.type)
    ;(recipient.userIds || []).forEach((id) => formData.append(`actions[${index}][userIds]`, id))
    ;(recipient.roleIds || []).forEach((id) => formData.append(`actions[${index}][roleIds]`, id))
    ;(recipient.departmentIds || []).forEach((id) => formData.append(`actions[${index}][departmentIds]`, id))
  })

  Object.entries(samplePayload).forEach(([key, value]) => {
    formData.set(`samplePayload[${key}]`, value)
  })

  return formData
}

function serializeWorkflowState({
  name,
  enabled,
  triggerType,
  conditions,
  actions,
}: {
  name: string
  enabled: boolean
  triggerType: string
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
}) {
  return JSON.stringify({
    name,
    enabled,
    triggerType,
    conditions: normalizeWorkflowConditions(conditions),
    actions: normalizeWorkflowActions(actions),
  })
}

function WorkflowTestDialog({
  open,
  onOpenChange,
  triggerLabel,
  triggerFields,
  users,
  conditions,
  actions,
  samplePayload,
  onSamplePayloadChange,
  result,
  isTesting,
  onRunPreview,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerLabel: string
  triggerFields: Array<{ value: string; label: string }>
  users: Option[]
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  samplePayload: Record<string, string>
  onSamplePayloadChange: React.Dispatch<React.SetStateAction<Record<string, string>>>
  result: WorkflowPreviewResult | null
  isTesting: boolean
  onRunPreview: () => void
}) {
  const t = useTranslations('settings.workflowsPage')
  const commonT = useTranslations('common')
  const hasPersonContext = triggerFields.some((field) =>
    ['employeeName', 'employeeId', 'birthdayDate', 'jobTitle'].includes(field.value),
  )
  const fields = React.useMemo(() => {
    const labels = new Map(triggerFields.map((field) => [field.value, field.label]))
    const referencedFields = getReferencedSampleFields(conditions, actions)
    return Object.keys(samplePayload)
      .filter(isEditableSampleField)
      .filter((key) => !hasPersonContext || (key !== 'employeeName' && key !== 'employeeId'))
      .filter((key) => referencedFields.has(key))
      .map((key) => ({
        value: key,
        label: getTranslatedVariableLabel(key, labels.get(key) || toVariableLabel(key), t),
      }))
  }, [actions, conditions, hasPersonContext, samplePayload, t, triggerFields])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[min(820px,calc(100vh-4rem))] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-4xl">
        <DialogHeader className="min-h-0">
          <DialogTitle>{t('testRun.title')}</DialogTitle>
          <DialogDescription>
            {t('testRun.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-4 overflow-hidden lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">{triggerLabel}</p>
              <p className="text-xs text-muted-foreground">{t('testRun.sampleContext')}</p>
            </div>
            {hasPersonContext && users.length > 0 && (
              <div className="grid gap-1.5">
                <Label>{t('testRun.samplePerson')}</Label>
                <Select
                  value={samplePayload.employeeId || ''}
                  onValueChange={(employeeId) => {
                    const user = users.find((item) => item.id === employeeId)
                    onSamplePayloadChange((current) => ({
                      ...current,
                      employeeId,
                      employeeName: user?.label || current.employeeName || '',
                      departmentId: current.departmentId?.startsWith('sample-') ? '' : current.departmentId,
                    }))
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('testRun.choosePerson')} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-3">
              {fields.map((field) => (
                <div key={field.value} className="grid gap-1.5">
                  <Label htmlFor={`sample-${field.value}`}>{field.label}</Label>
                  <Input
                    id={`sample-${field.value}`}
                    value={samplePayload[field.value] || ''}
                    onChange={(event) =>
                      onSamplePayloadChange((current) => ({
                        ...current,
                        [field.value]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
              {fields.length === 0 && !hasPersonContext && (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  {t('testRun.noEditableFields')}
                </p>
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto overscroll-contain rounded-md border p-3">
            {result ? <WorkflowPreviewResultView result={result} /> : (
              <div className="flex h-full min-h-52 items-center justify-center rounded-md border border-dashed p-6 text-center">
                <div>
                  <PlayCircle className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">{t('testRun.noPreviewYet')}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('testRun.noPreviewDescription')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {commonT('close')}
          </Button>
          <Button type="button" onClick={onRunPreview} disabled={isTesting}>
            <PlayCircle className="size-4" />
            {isTesting ? t('testRun.running') : t('testRun.runPreview')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function WorkflowPreviewResultView({ result }: { result: WorkflowPreviewResult }) {
  const t = useTranslations('settings.workflowsPage')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{t('testRun.previewResult')}</p>
          <p className="text-xs text-muted-foreground">
            {result.sourceType} · {result.sourceId}
          </p>
        </div>
        <PreviewStatusBadge status={result.status} />
      </div>

      {result.error && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{result.error}</p>}

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase text-muted-foreground">{t('sections.conditions')}</p>
        {result.conditionResults.results.length === 0 ? (
          <p className="rounded-md border p-3 text-sm text-muted-foreground">
            {t('testRun.noConditionPreview')}
          </p>
        ) : (
          result.conditionResults.results.map((condition, index) => (
            <div key={`${condition.field}-${index}`} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {condition.field} {condition.operator}
                </p>
                <PreviewMatchBadge matched={condition.matches} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('testRun.actualExpected', {
                  actual: formatPreviewValue(condition.actual, t),
                  expected: formatPreviewValue(condition.expected, t),
                })}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase text-muted-foreground">{t('sections.actions')}</p>
        {result.actions.map((action) => (
          <div key={action.index} className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{getTranslatedActionLabel(action.type, t)}</p>
              <PreviewStatusBadge status={action.status} />
            </div>
            {action.error && <p className="text-sm text-destructive">{action.error}</p>}
            {action.title && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t('testRun.renderedTitle')}</p>
                <p className="text-sm">{action.title}</p>
              </div>
            )}
            {(action.message || action.body) && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {action.type === 'postAnnouncement' ? t('testRun.renderedBody') : t('testRun.renderedMessage')}
                </p>
                <p className="whitespace-pre-wrap text-sm">
                  {action.type === 'postAnnouncement' ? action.body : action.message}
                </p>
              </div>
            )}
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <RecipientPreviewList title={getPreviewRecipientTitle(action.type, t)} recipients={action.recipients} />
              <ExternalRecipientPreviewList recipients={action.externalEmails} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecipientPreviewList({
  title,
  recipients,
}: {
  title: string
  recipients: Array<{ fullName: string; email: string }>
}) {
  const t = useTranslations('settings.workflowsPage')

  return (
    <div className="rounded-md bg-muted/40 p-2">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {recipients.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">{t('testRun.noneResolved')}</p>
      ) : (
        <div className="mt-1 space-y-1">
          {recipients.map((recipient, index) => (
            <p key={`${recipient.email}-${index}`} className="truncate text-xs">
              {recipient.fullName}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function ExternalRecipientPreviewList({
  recipients,
}: {
  recipients: Array<{ fullName: string; email: string }>
}) {
  const t = useTranslations('settings.workflowsPage')

  return (
    <div className="rounded-md bg-muted/40 p-2">
      <p className="text-xs font-medium text-muted-foreground">{t('testRun.externalEmails')}</p>
      {recipients.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">{t('testRun.noneResolved')}</p>
      ) : (
        <div className="mt-1 space-y-1">
          {recipients.map((recipient, index) => (
            <p key={`${recipient.email}-${index}`} className="truncate text-xs">
              {recipient.fullName ? `${recipient.fullName} · ` : ''}{recipient.email}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function PreviewStatusBadge({ status }: { status: WorkflowPreviewResult['status'] | WorkflowPreviewActionStatus }) {
  const t = useTranslations('settings.workflowsPage')

  if (status === 'wouldRun') {
    return <Badge><CheckCircle2 className="size-3" /> {t('testRun.status.wouldRun')}</Badge>
  }
  if (status === 'skipped') return <Badge variant="secondary">{t('testRun.status.wouldSkip')}</Badge>
  return <Badge variant="destructive"><XCircle className="size-3" /> {t('testRun.status.failed')}</Badge>
}

type WorkflowPreviewActionStatus = WorkflowPreviewResult['actions'][number]['status']

function getPreviewRecipientTitle(
  type: WorkflowPreviewResult['actions'][number]['type'],
  t: WorkflowTranslation,
) {
  if (type === 'sendEmail') return t('testRun.emailRecipients')
  if (type === 'postAnnouncement') return t('testRun.announcementAudience')
  if (type === 'createActivityLog') return t('testRun.activitySubjects')
  return t('testRun.inAppRecipients')
}

function PreviewMatchBadge({ matched }: { matched: boolean }) {
  const t = useTranslations('settings.workflowsPage')
  return matched ? <Badge>{t('testRun.matched')}</Badge> : <Badge variant="secondary">{t('testRun.notMatched')}</Badge>
}

function formatPreviewValue(value: unknown, t: WorkflowTranslation) {
  if (value == null || value === '') return t('testRun.emptyValue')
  return String(value)
}

function getReferencedSampleFields(conditions: WorkflowCondition[], actions: WorkflowAction[]) {
  const fields = new Set<string>()
  conditions.forEach((condition) => fields.add(condition.field))
  actions.forEach((action) => {
    for (const template of [action.title, action.message, action.body]) {
      extractTemplateVariables(template || '').forEach((field) => fields.add(field))
    }
  })
  return fields
}

function extractTemplateVariables(template: string) {
  const fields = new Set<string>()
  for (const match of template.matchAll(/\{\{([^}]+)\}\}|\{([^}]+)\}/g)) {
    const field = String(match[1] || match[2] || '').trim()
    if (field) fields.add(field)
  }
  return fields
}

function toVariableLabel(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (letter) => letter.toUpperCase())
}

function isEditableSampleField(value: string) {
  if (value === 'status') return false
  return !isIdVariable(value)
}

function FlowSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{label}</p>
      {children}
    </div>
  )
}

function FlowBlock({
  active,
  disabled = false,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean
  disabled?: boolean
  icon: React.ReactNode
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'grid w-full grid-cols-[auto_1fr] gap-3 rounded-md border p-4 text-left transition-colors',
        disabled
          ? 'cursor-not-allowed bg-muted/40 opacity-60'
          : active
            ? 'border-primary bg-primary/10'
            : 'bg-background hover:bg-accent',
      ].join(' ')}
    >
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="mt-1 block truncate text-sm text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  )
}

function BuilderOptionsPanel({
  selectedBlock,
  triggerType,
  triggerFields,
  conditions,
  actions,
  options,
  onTriggerChange,
  onConditionsChange,
  onActionChange,
  onActionRemove,
}: {
  selectedBlock: SelectedBlock
  triggerType: string
  triggerFields: Array<{ value: string; label: string }>
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  options: WorkflowAdminData['options']
  onTriggerChange: (value: string) => void
  onConditionsChange: (conditions: WorkflowCondition[]) => void
  onActionChange: (index: number, action: WorkflowAction) => void
  onActionRemove: (index: number) => void
}) {
  const t = useTranslations('settings.workflowsPage')
  const selectedActionIndex = selectedBlock.startsWith('action-')
    ? Number(selectedBlock.replace('action-', ''))
    : -1
  const selectedAction = actions[selectedActionIndex]
  const triggerCategories = React.useMemo(() => {
    return Array.from(new Set(options.triggers.map((definition) => definition.source)))
  }, [options.triggers])
  const selectedTrigger = options.triggers.find((definition) => definition.type === triggerType)
  const [selectedCategory, setSelectedCategory] = React.useState(
    selectedTrigger?.source || triggerCategories[0] || '',
  )
  React.useEffect(() => {
    if (!selectedTrigger) return
    setSelectedCategory(selectedTrigger.source)
  }, [selectedTrigger])
  const visibleTriggers = options.triggers.filter(
    (definition) => definition.source === selectedCategory,
  )
  const conditionFields = React.useMemo(() => getConditionFields(triggerFields), [triggerFields])

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <CardHeader className="shrink-0">
        <CardTitle className="text-base">{getPanelTitle(selectedBlock, t)}</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        {selectedBlock === 'trigger' && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-lg font-semibold">{t('panels.chooseHowToStart')}</p>
              <p className="text-sm text-muted-foreground">
                {t('panels.launchDescription')}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {triggerCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={[
                    'flex min-h-11 items-center gap-2 rounded-md border px-3 text-left text-sm font-medium transition-colors',
                    selectedCategory === category
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground',
                  ].join(' ')}
                >
                  {getTriggerCategoryIcon(category)}
                  <span className="truncate">{getTranslatedTriggerSource(category, t)}</span>
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleTriggers.map((definition) => (
                <button
                  key={definition.type}
                  type="button"
                  onClick={() => onTriggerChange(definition.type)}
                  className={[
                    'grid min-h-20 grid-cols-[auto_1fr] items-center gap-3 rounded-md border p-3 text-left transition-colors',
                    triggerType === definition.type
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'bg-muted/40 hover:bg-accent',
                  ].join(' ')}
                >
                  <Workflow className="size-5 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-snug">
                      {getTranslatedTriggerLabel(definition.type, definition.label, t)}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {getTranslatedTriggerSource(definition.source, t)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!triggerType && selectedBlock !== 'trigger' && (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            {t('conditions.chooseStarterFirst')}
          </div>
        )}

        {selectedBlock === 'conditions' && triggerType && (
          <ConditionsPanel
            conditions={conditions}
            fields={conditionFields}
            options={options}
            onChange={onConditionsChange}
          />
        )}

        {selectedAction && triggerType && (
          <ActionPanel
            action={selectedAction}
            index={selectedActionIndex}
            options={options}
            triggerType={triggerType}
            triggerFields={triggerFields}
            onChange={(action) => onActionChange(selectedActionIndex, action)}
            onRemove={() => onActionRemove(selectedActionIndex)}
          />
        )}
      </CardContent>
    </Card>
  )
}

function ConditionsPanel({
  conditions,
  fields,
  options,
  onChange,
}: {
  conditions: WorkflowCondition[]
  fields: Array<{ value: string; label: string }>
  options: WorkflowAdminData['options']
  onChange: (conditions: WorkflowCondition[]) => void
}) {
  const t = useTranslations('settings.workflowsPage')
  const commonT = useTranslations('common')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('conditions.allMustMatch')}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={fields.length === 0}
          onClick={() =>
            onChange([
              ...conditions,
              {
                ...defaultCondition,
                field: fields[0]?.value || defaultCondition.field,
              },
            ])
          }
        >
          <Plus className="size-4" />
          {commonT('add')}
        </Button>
      </div>
      {conditions.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          {t('conditions.noneDescription')}
        </p>
      ) : (
        conditions.map((condition, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <div className="flex items-center gap-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <span className="rounded-full border bg-background px-2 py-0.5">
                  {t('conditions.andConnector')}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            <ConditionRow
              condition={condition}
              fields={fields}
              options={options}
              onChange={(next) =>
                onChange(conditions.map((item, itemIndex) => (itemIndex === index ? next : item)))
              }
              onRemove={() => onChange(conditions.filter((_, itemIndex) => itemIndex !== index))}
            />
          </React.Fragment>
        ))
      )}
    </div>
  )
}

function ConditionRow({
  condition,
  fields,
  options,
  onChange,
  onRemove,
}: {
  condition: WorkflowCondition
  fields: Array<{ value: string; label: string }>
  options: WorkflowAdminData['options']
  onChange: (condition: WorkflowCondition) => void
  onRemove: () => void
}) {
  const t = useTranslations('settings.workflowsPage')
  const operator = WORKFLOW_CONDITION_OPERATORS.find((item) => item.value === condition.operator)
  const selectedField = fields.find((field) => field.value === condition.field)

  return (
    <div className="space-y-2 rounded-md border p-3">
      <Select
        value={condition.field}
        onValueChange={(field) => onChange({ ...condition, field, value: '' })}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fields.map((field) => (
            <SelectItem key={field.value} value={field.value}>
              {getTranslatedVariableLabel(field.value, field.label, t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={condition.operator}
        onValueChange={(operator) =>
          onChange({ ...condition, operator: operator as WorkflowCondition['operator'] })
        }
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {WORKFLOW_CONDITION_OPERATORS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {getTranslatedOperatorLabel(item.value, item.label, t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <ConditionValueInput
          condition={condition}
          field={selectedField}
          options={options}
          requiresValue={Boolean(operator?.requiresValue)}
          onChange={(value) => onChange({ ...condition, value })}
        />
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={t('conditions.remove')}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function ConditionValueInput({
  condition,
  field,
  options,
  requiresValue,
  onChange,
}: {
  condition: WorkflowCondition
  field?: { value: string; label: string }
  options: WorkflowAdminData['options']
  requiresValue: boolean
  onChange: (value: string) => void
}) {
  const t = useTranslations('settings.workflowsPage')
  const valueOptions = getConditionValueOptions(field?.value || '', options, t)

  if (!requiresValue) {
    return (
      <Input
        value=""
        disabled
        placeholder={t('conditions.noValueNeeded')}
      />
    )
  }

  if (valueOptions.length > 0) {
    return (
      <Select value={condition.value || ''} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t('conditions.valuePlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {valueOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <Input
      value={condition.value || ''}
      placeholder={t('conditions.valuePlaceholder')}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function getConditionFields(fields: Array<{ value: string; label: string }>) {
  return fields.filter((field) => !isIdVariable(field.value) && field.value !== 'linkUrl')
}

function getConditionValueOptions(
  field: string,
  options: WorkflowAdminData['options'],
  t: WorkflowTranslation,
): Array<{ value: string; label: string }> {
  if (field === 'employeeName') {
    return options.users.map((user) => ({ value: user.label, label: user.label }))
  }
  if (field === 'status') return getStatusOptions(t)
  if (field === 'previousStatus') return getStatusOptions(t)
  if (field === 'calendarItemType') return getCalendarItemTypeOptions(t)
  if (field === 'month') {
    return Array.from({ length: 12 }, (_, index) => {
      const value = String(index + 1).padStart(2, '0')
      return { value, label: value }
    })
  }
  return []
}

function getCalendarItemTypeOptions(t: WorkflowTranslation) {
  return [
    'birthday',
    'work_anniversary',
    'holiday',
    'event',
    'leave',
  ].map((type) => ({
    value: type,
    label: t(`calendarItemTypes.${type}`),
  }))
}

function getStatusOptions(t: WorkflowTranslation) {
  return [
    'active',
    'inactive',
    'pending',
    'requested',
    'approved',
    'rejected',
    'cancelled',
    'generated',
    'paid',
    'new',
    'assigned',
    'draft',
    'underReview',
    'shortlisted',
    'hired',
  ].map((status) => ({
    value: status,
    label: t(`statusValues.${status}`),
  }))
}

function ActionPanel({
  action,
  index,
  options,
  triggerType,
  triggerFields,
  onChange,
  onRemove,
}: {
  action: WorkflowAction
  index: number
  options: WorkflowAdminData['options']
  triggerType: string
  triggerFields: Array<{ value: string; label: string }>
  onChange: (action: WorkflowAction) => void
  onRemove: () => void
}) {
  const t = useTranslations('settings.workflowsPage')
  const suggestedAction = applySuggestedActionText(action, triggerType, t)
  const currentMessage = action.type === 'postAnnouncement' ? action.body || '' : action.message || ''
  const suggestedMessage = action.type === 'postAnnouncement'
    ? suggestedAction.body || ''
    : suggestedAction.message || ''
  const hasSuggestion = Boolean(suggestedAction.title || suggestedMessage)
  const alreadyUsingSuggestion =
    (action.title || '') === (suggestedAction.title || '') && currentMessage === suggestedMessage

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('actions.actionNumber', { number: index + 1 })}</p>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={t('actions.removeAction')}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="grid gap-2">
        <Label>{t('fields.action')}</Label>
        <Select
          value={action.type}
          onValueChange={(type) => onChange({ ...action, type: type as WorkflowAction['type'] })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WORKFLOW_ACTION_DEFINITIONS.map((definition) => (
              <SelectItem key={definition.type} value={definition.type}>
                {getTranslatedActionLabel(definition.type, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>{t('fields.titleSubject')}</Label>
        <Input
          value={action.title || ''}
          onChange={(event) => onChange({ ...action, title: event.target.value })}
          placeholder="{{title}}"
        />
        <p className="text-xs text-muted-foreground">
          {t('fields.titleHelp')}
        </p>
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <Label>{action.type === 'postAnnouncement' ? t('fields.body') : t('fields.message')}</Label>
          {hasSuggestion && !alreadyUsingSuggestion && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange(suggestedAction)}
            >
              {t('actions.useSuggestedMessage')}
            </Button>
          )}
        </div>
        <Textarea
          value={currentMessage}
          onChange={(event) =>
            onChange(
              action.type === 'postAnnouncement'
                ? { ...action, body: event.target.value }
                : { ...action, message: event.target.value },
            )
          }
          placeholder={suggestedMessage || getActionMessagePlaceholder(action.type, triggerType, triggerFields, t)}
        />
        <p className="text-xs text-muted-foreground">
          {t('fields.defaultMessageHelp')}
        </p>
      </div>
      {action.type !== 'postAnnouncement' && action.type !== 'createActivityLog' && (
        <RecipientPresetSelector action={action} options={options} onChange={onChange} />
      )}
      <VariableGuide
        fields={triggerFields}
        t={t}
        onInsert={(token) => {
          const current = action.type === 'postAnnouncement' ? action.body || '' : action.message || ''
          const next = appendToken(current, token)
          onChange(
            action.type === 'postAnnouncement'
              ? { ...action, body: next }
              : { ...action, message: next },
          )
        }}
      />
    </div>
  )
}

const commonContentVariables = [
  { value: 'title', label: 'Title' },
  { value: 'status', label: 'Status' },
]

const peopleVariables = [
  { value: 'employeeName', label: 'Employee name' },
]

function VariableGuide({
  fields,
  t,
  onInsert,
}: {
  fields: Array<{ value: string; label: string }>
  t: WorkflowTranslation
  onInsert: (token: string) => void
}) {
  const fieldValues = new Set(fields.map((field) => field.value))
  const relevantCommonVariables = commonContentVariables.filter(
    (field) => field.value === 'title' || fieldValues.has(field.value),
  )
  const groupedValues = new Set([
    ...commonContentVariables.map((field) => field.value),
    ...peopleVariables.map((field) => field.value),
  ])
  const relevantPeopleVariables = peopleVariables.filter((field) => fieldValues.has(field.value))
  const triggerVariables = fields.filter(
    (field) => !groupedValues.has(field.value) && !isIdVariable(field.value) && isHumanMessageVariable(field.value),
  )

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div>
        <p className="text-sm font-medium">{t('variables.title')}</p>
        <p className="text-xs text-muted-foreground">
          {t('variables.description')}
        </p>
      </div>
      <VariableGroup title={t('variables.groups.common')} fields={relevantCommonVariables} t={t} onInsert={onInsert} />
      <VariableGroup title={t('variables.groups.people')} fields={relevantPeopleVariables} t={t} onInsert={onInsert} />
      <VariableGroup title={t('variables.groups.trigger')} fields={triggerVariables} t={t} onInsert={onInsert} />
    </div>
  )
}

function appendToken(current: string, token: string) {
  if (!current.trim()) return token
  if (current.endsWith(' ') || current.endsWith('\n')) return `${current}${token}`
  return `${current} ${token}`
}

function isIdVariable(value: string) {
  return value === 'id' || value.endsWith('Id') || value.endsWith('UserId')
}

function isHumanMessageVariable(value: string) {
  return value !== 'body' && value !== 'message' && value !== 'linkUrl'
}

function getActionMessagePlaceholder(
  actionType: WorkflowAction['type'],
  triggerType: string,
  fields: Array<{ value: string; label: string }>,
  t?: WorkflowTranslation,
) {
  const suggestion = getSuggestedActionText(actionType, triggerType, t)
  if (suggestion.message) return suggestion.message
  if (suggestion.body) return suggestion.body

  const values = new Set(fields.map((field) => field.value))
  if (values.has('leaveType')) {
    return t ? rawWorkflowMessage(t, 'placeholders.leave') : '{{employeeName}} requested {{totalDays}} days of {{leaveType}} leave.'
  }
  if (values.has('calendarItemType')) return t ? rawWorkflowMessage(t, 'placeholders.calendarItem') : '{{title}} is coming up on {{date}}.'
  if (values.has('month') && values.has('year')) return t ? rawWorkflowMessage(t, 'placeholders.payroll') : 'Payroll for {{month}} {{year}} is {{status}}.'
  if (values.has('amount') && values.has('category')) return t ? rawWorkflowMessage(t, 'placeholders.expense') : '{{category}} expense: {{name}} - {{amount}}'
  if (values.has('applicantName')) return t ? rawWorkflowMessage(t, 'placeholders.applicant') : '{{applicantName}} applied for {{position}}.'
  if (values.has('model')) return t ? rawWorkflowMessage(t, 'placeholders.inventory') : 'Inventory item {{model}} has been updated.'
  if (values.has('channelName')) return t ? rawWorkflowMessage(t, 'placeholders.announcement') : '{{actorName}} posted in {{channelName}}.'
  if (actionType === 'postAnnouncement') {
    return t ? t('placeholders.announcementBody') : 'Write the announcement body, or leave empty for the default message.'
  }
  return t ? t('placeholders.message') : 'Write a message, or leave empty for the default message.'
}

function applySuggestedActionText(action: WorkflowAction, triggerType: string, t?: WorkflowTranslation): WorkflowAction {
  const suggestion = getSuggestedActionText(action.type, triggerType, t)
  return {
    ...action,
    title: suggestion.title || action.title,
    message: action.type === 'postAnnouncement' ? action.message : suggestion.message,
    body: action.type === 'postAnnouncement' ? suggestion.body : action.body,
  }
}

function mergeSuggestedActionText(
  action: WorkflowAction,
  previousTriggerType: string,
  nextTriggerType: string,
  t?: WorkflowTranslation,
): WorkflowAction {
  const previousSuggestion = previousTriggerType
    ? getSuggestedActionText(action.type, previousTriggerType, t)
    : { title: '{{title}}', message: '', body: '' }
  const nextSuggestion = getSuggestedActionText(action.type, nextTriggerType, t)
  const currentBody = action.type === 'postAnnouncement' ? action.body || '' : action.message || ''
  const previousBody = action.type === 'postAnnouncement'
    ? previousSuggestion.body || ''
    : previousSuggestion.message || ''
  const nextBody = action.type === 'postAnnouncement'
    ? nextSuggestion.body || ''
    : nextSuggestion.message || ''
  const shouldReplaceTitle = isBlankOrGenericTitle(action.title) || (action.title || '') === (previousSuggestion.title || '')
  const shouldReplaceBody = !currentBody || currentBody === previousBody

  return {
    ...action,
    title: shouldReplaceTitle ? nextSuggestion.title || action.title : action.title,
    message: action.type === 'postAnnouncement'
      ? action.message
      : shouldReplaceBody
        ? nextBody
        : action.message,
    body: action.type === 'postAnnouncement'
      ? shouldReplaceBody
        ? nextBody
        : action.body
      : action.body,
  }
}

function isBlankOrGenericTitle(title?: string) {
  return !title || title === '{{title}}'
}

function getSuggestedActionText(
  actionType: WorkflowAction['type'],
  triggerType: string,
  t?: WorkflowTranslation,
): { title: string; message?: string; body?: string } {
  const text = getSuggestedTriggerText(triggerType, t)
  if (actionType === 'postAnnouncement') {
    return { title: text.title, body: text.message }
  }
  if (actionType === 'createActivityLog') {
    return { title: text.title, message: text.message }
  }
  return text
}

function getSuggestedTriggerText(triggerType: string, t?: WorkflowTranslation): { title: string; message: string } {
  const key = getSuggestionKey(triggerType)
  if (t && key) {
    return {
      title: rawWorkflowMessage(t, `suggestions.${key}.title`),
      message: rawWorkflowMessage(t, `suggestions.${key}.message`),
    }
  }

  if (triggerType === WORKFLOW_TRIGGER_TYPES.employeeCreated) {
    return {
      title: 'Welcome, {{employeeName}}',
      message: 'Hi {{employeeName}}, welcome to the team. We are happy to have you with us.',
    }
  }
  if (triggerType === WORKFLOW_TRIGGER_TYPES.calendarItemUpcoming) {
    return {
      title: '{{title}}',
      message: '{{title}} is coming up on {{date}}. Days until: {{daysUntil}}.',
    }
  }
  if (triggerType === WORKFLOW_TRIGGER_TYPES.leaveRequested) {
    return {
      title: 'New leave request from {{employeeName}}',
      message: '{{employeeName}} requested {{totalDays}} days of {{leaveType}} leave from {{startDate}} to {{endDate}}.',
    }
  }
  if (triggerType === WORKFLOW_TRIGGER_TYPES.leaveUpdated) {
    return {
      title: 'Leave {{status}} for {{employeeName}}',
      message: '{{employeeName}} leave changed from {{previousStatus}} to {{status}}.',
    }
  }
  if (triggerType === WORKFLOW_TRIGGER_TYPES.applicantCreated) {
    return {
      title: 'New applicant: {{applicantName}}',
      message: '{{applicantName}} applied for {{position}}.',
    }
  }
  if (triggerType === WORKFLOW_TRIGGER_TYPES.payrollGenerated) {
    return {
      title: 'Payroll generated for {{month}} {{year}}',
      message: 'Payroll for {{employeeName}} for {{month}} {{year}} is generated.',
    }
  }
  if (triggerType === WORKFLOW_TRIGGER_TYPES.payrollStatusChanged) {
    return {
      title: 'Payroll {{status}} for {{employeeName}}',
      message: 'Payroll for {{employeeName}} changed from {{previousStatus}} to {{status}}.',
    }
  }
  if (triggerType === WORKFLOW_TRIGGER_TYPES.inventoryCreated) {
    return {
      title: 'New inventory item: {{model}}',
      message: 'Inventory item {{model}} with serial number {{serialNumber}} was created.',
    }
  }
  if (triggerType === WORKFLOW_TRIGGER_TYPES.inventoryUpdated) {
    return {
      title: 'Inventory updated: {{model}}',
      message: 'Inventory item {{model}} is now {{status}}.',
    }
  }
  if (triggerType === WORKFLOW_TRIGGER_TYPES.expenseCreated) {
    return {
      title: 'New expense: {{name}}',
      message: '{{category}} expense {{name}} was created for {{amount}}.',
    }
  }
  if (triggerType === WORKFLOW_TRIGGER_TYPES.expenseUpdated) {
    return {
      title: 'Expense updated: {{name}}',
      message: '{{category}} expense {{name}} was updated.',
    }
  }
  if (triggerType === WORKFLOW_TRIGGER_TYPES.expenseGenerationDue) {
    return {
      title: 'Expense generation due: {{name}}',
      message: '{{name}} should be generated on {{generationDate}}.',
    }
  }
  if (triggerType === WORKFLOW_TRIGGER_TYPES.expensePaymentDue) {
    return {
      title: 'Expense payment due: {{name}}',
      message: '{{name}} payment is due on {{dueDate}} for {{amount}}.',
    }
  }
  if (triggerType === WORKFLOW_TRIGGER_TYPES.expensePaymentGenerated) {
    return {
      title: 'Expense payment generated: {{name}}',
      message: '{{name}} payment was generated for {{amount}}.',
    }
  }
  if (triggerType.startsWith('calendar_event.')) {
    return {
      title: '{{title}}',
      message: '{{title}} is scheduled for {{timeLabel}} at {{location}}.',
    }
  }
  if (triggerType.startsWith('announcement.')) {
    return {
      title: '{{title}}',
      message: '{{actorName}} posted in {{channelName}}.',
    }
  }
  return {
    title: '{{title}}',
    message: '',
  }
}

function getSuggestionKey(triggerType: string) {
  if (triggerType === WORKFLOW_TRIGGER_TYPES.employeeCreated) return 'employeeCreated'
  if (triggerType === WORKFLOW_TRIGGER_TYPES.calendarItemUpcoming) return 'calendarItemUpcoming'
  if (triggerType === WORKFLOW_TRIGGER_TYPES.leaveRequested) return 'leaveRequested'
  if (triggerType === WORKFLOW_TRIGGER_TYPES.leaveUpdated) return 'leaveUpdated'
  if (triggerType === WORKFLOW_TRIGGER_TYPES.applicantCreated) return 'applicantCreated'
  if (triggerType === WORKFLOW_TRIGGER_TYPES.payrollGenerated) return 'payrollGenerated'
  if (triggerType === WORKFLOW_TRIGGER_TYPES.payrollStatusChanged) return 'payrollStatusChanged'
  if (triggerType === WORKFLOW_TRIGGER_TYPES.inventoryCreated) return 'inventoryCreated'
  if (triggerType === WORKFLOW_TRIGGER_TYPES.inventoryUpdated) return 'inventoryUpdated'
  if (triggerType === WORKFLOW_TRIGGER_TYPES.expenseCreated) return 'expenseCreated'
  if (triggerType === WORKFLOW_TRIGGER_TYPES.expenseUpdated) return 'expenseUpdated'
  if (triggerType === WORKFLOW_TRIGGER_TYPES.expenseGenerationDue) return 'expenseGenerationDue'
  if (triggerType === WORKFLOW_TRIGGER_TYPES.expensePaymentDue) return 'expensePaymentDue'
  if (triggerType === WORKFLOW_TRIGGER_TYPES.expensePaymentGenerated) return 'expensePaymentGenerated'
  if (triggerType.startsWith('calendar_event.')) return 'calendarEvent'
  if (triggerType.startsWith('announcement.')) return 'announcement'
  return 'default'
}

function VariableGroup({
  title,
  fields,
  t,
  onInsert,
}: {
  title: string
  fields: Array<{ value: string; label: string }>
  t: WorkflowTranslation
  onInsert: (token: string) => void
}) {
  if (fields.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase text-muted-foreground">{title}</p>
      <div className="grid gap-2">
        {fields.map((field) => {
          const token = `{{${field.value}}}`
          return (
            <button
              key={field.value}
              type="button"
              onClick={() => {
                onInsert(token)
                notify.success(t('notices.variableAdded'))
              }}
              className="rounded-md border bg-background p-2 text-left transition-colors hover:bg-accent"
            >
              <span className="block font-mono text-xs font-semibold">{token}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {getTranslatedVariableDescription(field.value, field.label, t)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RecipientPresetSelector({
  action,
  options,
  onChange,
}: {
  action: WorkflowAction
  options: WorkflowAdminData['options']
  onChange: (action: WorkflowAction) => void
}) {
  const t = useTranslations('settings.workflowsPage')
  const recipient = action.recipients?.[0] || { type: 'eventRecipients' as const }

  function updateRecipient(next: Partial<WorkflowRecipientSelector>) {
    onChange({
      ...action,
      recipients: [{ ...recipient, ...next }],
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Label>{t('recipients.preset')}</Label>
        <Select
          value={recipient.type}
          onValueChange={(type) =>
            updateRecipient({
              type: type as WorkflowRecipientSelector['type'],
              userIds: [],
              roleIds: [],
              departmentIds: [],
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WORKFLOW_RECIPIENT_DEFINITIONS.map((definition) => (
              <SelectItem key={definition.type} value={definition.type}>
                {getTranslatedRecipientLabel(definition.type, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {recipient.type === 'specificUsers' && (
        <CompactUserPicker
          label={t('recipients.specificUsers')}
          options={options.users}
          selectedValues={recipient.userIds || []}
          onChange={(userIds) => updateRecipient({ userIds })}
          placeholder={t('recipients.chooseUsers')}
          searchPlaceholder={t('recipients.searchUsers')}
          emptyMessage={t('recipients.noUsersFound')}
        />
      )}
      {recipient.type === 'usersWithRole' && (
        <MultiCheckbox
          label={t('recipients.roles')}
          options={options.roles}
          selected={recipient.roleIds || []}
          onChange={(roleIds) => updateRecipient({ roleIds })}
        />
      )}
      {recipient.type === 'usersInDepartment' && (
        <MultiCheckbox
          label={t('recipients.departments')}
          options={options.departments}
          selected={recipient.departmentIds || []}
          onChange={(departmentIds) => updateRecipient({ departmentIds })}
        />
      )}
    </div>
  )
}

function CompactUserPicker({
  label,
  options,
  selectedValues,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
}: {
  label: string
  options: Option[]
  selectedValues: string[]
  onChange: (values: string[]) => void
  placeholder: string
  searchPlaceholder: string
  emptyMessage: string
}) {
  const [open, setOpen] = React.useState(false)
  const selectedOptions = options.filter((option) => selectedValues.includes(option.id))
  const dropdownOptions = [
    ...selectedOptions,
    ...options.filter((option) => !selectedValues.includes(option.id)),
  ]

  function toggleValue(value: string) {
    onChange(
      selectedValues.includes(value)
        ? selectedValues.filter((selectedValue) => selectedValue !== value)
        : [...selectedValues, value],
    )
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-auto min-h-10 w-full justify-between gap-3 whitespace-normal"
          >
            <span className="flex min-w-0 flex-1 flex-wrap gap-1 text-left">
              {selectedOptions.length > 0 ? (
                selectedOptions.map((option) => (
                  <Badge key={option.id} variant="secondary">
                    {option.label}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">{placeholder}</span>
              )}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="max-h-56">
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {dropdownOptions.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={`${option.label} ${option.id}`}
                    onSelect={() => toggleValue(option.id)}
                  >
                    <Check
                      className={cn(
                        'size-4',
                        selectedValues.includes(option.id) ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span>{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function MultiCheckbox({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: Option[]
  selected: string[]
  onChange: (selected: string[]) => void
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="max-h-44 space-y-2 overflow-auto">
        {options.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.includes(option.id)}
              onCheckedChange={(checked) =>
                onChange(
                  checked === true
                    ? Array.from(new Set([...selected, option.id]))
                    : selected.filter((id) => id !== option.id),
                )
              }
            />
            <span className="truncate">{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function WorkflowButton({
  action,
  id,
  label,
  icon,
  destructive = false,
}: {
  action: (formData: FormData) => Promise<void>
  id: string
  label: string
  icon?: React.ReactNode
  destructive?: boolean
}) {
  const t = useTranslations('settings.workflowsPage')

  return (
    <form
      action={async (formData) => {
        try {
          await action(formData)
          notify.success(t('notices.updated'))
        } catch (error) {
          notify.error(error, t('notices.actionFailed'))
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        size="icon"
        variant={destructive ? 'destructive' : 'outline'}
        aria-label={label}
        title={label}
      >
        {icon}
      </Button>
    </form>
  )
}

function RunBadge({ status }: { status: string }) {
  const t = useTranslations('settings.workflowsPage')
  const variant = status === 'success' ? 'default' : status === 'failed' ? 'destructive' : 'secondary'
  return <Badge variant={variant}>{getTranslatedRunStatus(status, t)}</Badge>
}

type WorkflowTranslation = (key: any, values?: any) => string

function getPanelTitle(selectedBlock: SelectedBlock, t: WorkflowTranslation) {
  if (selectedBlock === 'trigger') return t('panels.chooseStarter')
  if (selectedBlock === 'conditions') return t('panels.configureConditions')
  return t('panels.configureAction')
}

function formatWorkflowSummary(workflow: WorkflowRow, t: WorkflowTranslation) {
  const triggerLabel = getTranslatedTriggerLabel(workflow.triggerType, workflow.triggerLabel, t)
  if (!workflow.actionSummary) return t('summary.whenOnly', { trigger: triggerLabel })
  return t('summary.whenThen', {
    trigger: triggerLabel,
    actions: translateActionSummary(workflow.actionSummary, t),
  })
}

function translateActionSummary(summary: string, t: WorkflowTranslation) {
  return summary
    .split(', ')
    .map((item) => {
      const match = WORKFLOW_ACTION_DEFINITIONS.find((definition) => definition.label === item)
      return match ? getTranslatedActionLabel(match.type, t) : item
    })
    .join(', ')
}

function getTranslatedTriggerLabel(type: string, fallback: string, t: WorkflowTranslation) {
  return t(`triggers.${translationKey(type)}`) || fallback
}

function getTranslatedTriggerSource(source: string, t: WorkflowTranslation) {
  return t(`sources.${source}`) || source
}

function getTranslatedActionLabel(type: WorkflowAction['type'], t: WorkflowTranslation) {
  return t(`actionTypes.${type}`)
}

function getTranslatedRecipientLabel(type: WorkflowRecipientSelector['type'], t: WorkflowTranslation) {
  return t(`recipientTypes.${type}`)
}

function getTranslatedOperatorLabel(value: WorkflowConditionOperator, fallback: string, t: WorkflowTranslation) {
  return t(`operators.${value}`) || fallback
}

function getTranslatedVariableLabel(value: string, fallback: string, t: WorkflowTranslation) {
  return safeWorkflowMessage(t, `variables.labels.${value}`, fallback)
}

function getTranslatedVariableDescription(value: string, fallback: string, t: WorkflowTranslation) {
  return safeWorkflowMessage(t, `variables.descriptions.${value}`, fallback)
}

function getTranslatedRunStatus(status: string, t: WorkflowTranslation) {
  if (status === 'success' || status === 'failed' || status === 'skipped' || status === 'running') {
    return t(`runStatuses.${status}`)
  }
  return status
}

function translationKey(value: string) {
  return value.replaceAll('.', '_')
}

function rawWorkflowMessage(t: WorkflowTranslation, key: string) {
  return (t as any).raw ? String((t as any).raw(key)) : t(key)
}

function safeWorkflowMessage(t: WorkflowTranslation, key: string, fallback: string) {
  const value = t(key)
  return value === `settings.workflowsPage.${key}` ? fallback : value
}

function getActionIcon(type: WorkflowAction['type']) {
  if (type === 'sendEmail') return <Mail className="size-5" />
  if (type === 'postAnnouncement') return <Megaphone className="size-5" />
  if (type === 'createActivityLog') return <ScrollText className="size-5" />
  return <Bell className="size-5" />
}

function getTriggerCategoryIcon(category: string) {
  const className = 'size-4 shrink-0 text-muted-foreground'
  if (category === 'Announcement') return <Megaphone className={className} />
  if (category === 'Calendar') return <CalendarClock className={className} />
  if (category === 'Leave') return <Plane className={className} />
  if (category === 'Payroll' || category === 'Expense') {
    return <CircleDollarSign className={className} />
  }
  if (category === 'Inventory') return <Package className={className} />
  if (category === 'Applicant' || category === 'Employee') return <UserPlus className={className} />
  if (category === 'Birthday' || category === 'Anniversary') return <Cake className={className} />
  return <Workflow className={className} />
}

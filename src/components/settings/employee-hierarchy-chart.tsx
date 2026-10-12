'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type HierarchyPerson = {
  id: string
  fullName: string
  photo: string | null
  jobTitle: string | null
  departmentId: string | null
  isProtectedAdmin: boolean
  departments: Array<{ id: string; name: string }>
  dottedManagers: Array<{ id: string; fullName: string }>
  canViewProfile: boolean
}

type EmployeeHierarchyChartProps = {
  people: HierarchyPerson[]
  rootDepartmentName: string
  rootManagerId: string | null
  departments: Array<{
    id: string
    name: string
    parentDepartmentId: string | null
    managerUserId: string | null
  }>
}

type EmployeeNodeData = {
  person: HierarchyPerson
}

const NODE_WIDTH = 260
const NODE_HEIGHT = 76
const X_GAP = 316
const Y_GAP = 160
const ROOT_GAP = 220
const MAX_LEAF_COLUMNS = 4
const MAX_BRANCH_COLUMNS = 3

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function primaryDepartmentName(person: HierarchyPerson) {
  return person.departments[0]?.name || ''
}

function matchesPerson(person: HierarchyPerson, query: string, departmentId: string) {
  const normalizedQuery = query.trim().toLowerCase()
  const matchesDepartment =
    departmentId === 'all' ||
    person.departments.some((department) => department.id === departmentId)

  if (!matchesDepartment) return false
  if (!normalizedQuery) return true

  return (
    person.fullName.toLowerCase().includes(normalizedQuery) ||
    (person.jobTitle || '').toLowerCase().includes(normalizedQuery) ||
    person.departments.some((department) => department.name.toLowerCase().includes(normalizedQuery))
  )
}

function sortPeople(a: HierarchyPerson, b: HierarchyPerson) {
  const departmentCompare = primaryDepartmentName(a).localeCompare(primaryDepartmentName(b))
  return departmentCompare || a.fullName.localeCompare(b.fullName)
}

function buildDepartmentMemberCounts(
  people: HierarchyPerson[],
  departments: EmployeeHierarchyChartProps['departments'],
) {
  const safeDepartments = departments || []
  const directCounts = new Map<string, number>()
  const childDepartmentIdsByParent = new Map<string, string[]>()
  const totalCounts = new Map<string, number>()

  for (const person of people) {
    const departmentId = getPrimaryDisplayDepartmentId(person)
    if (!departmentId) continue
    directCounts.set(departmentId, (directCounts.get(departmentId) || 0) + 1)
  }

  for (const department of safeDepartments) {
    if (!department.parentDepartmentId) continue
    const childDepartmentIds = childDepartmentIdsByParent.get(department.parentDepartmentId) || []
    childDepartmentIds.push(department.id)
    childDepartmentIdsByParent.set(department.parentDepartmentId, childDepartmentIds)
  }

  function resolve(departmentId: string, visited = new Set<string>()): number {
    if (totalCounts.has(departmentId)) return totalCounts.get(departmentId) || 0
    if (visited.has(departmentId)) return directCounts.get(departmentId) || 0
    visited.add(departmentId)

    const total =
      (directCounts.get(departmentId) || 0) +
      (childDepartmentIdsByParent.get(departmentId) || []).reduce(
        (sum, childDepartmentId) => sum + resolve(childDepartmentId, visited),
        0,
      )

    totalCounts.set(departmentId, total)
    return total
  }

  for (const department of safeDepartments) {
    resolve(department.id)
  }

  return totalCounts
}

function buildSubtreeSizes(childrenByManager: Map<string, HierarchyPerson[]>) {
  const cache = new Map<string, number>()

  function resolve(personId: string, visited = new Set<string>()): number {
    if (cache.has(personId)) return cache.get(personId) || 1
    if (visited.has(personId)) return 1
    visited.add(personId)

    const total =
      1 +
      (childrenByManager.get(personId) || []).reduce(
        (sum, child) => sum + resolve(child.id, visited),
        0,
      )

    cache.set(personId, total)
    return total
  }

  for (const personId of childrenByManager.keys()) {
    resolve(personId)
  }

  return cache
}

function getHierarchyWeight(
  person: HierarchyPerson,
  departmentMemberCounts: Map<string, number>,
  subtreeSizes: Map<string, number>,
) {
  const departmentId = getPrimaryDisplayDepartmentId(person)
  const departmentSize = departmentId ? departmentMemberCounts.get(departmentId) || 0 : 0
  return Math.max(departmentSize, subtreeSizes.get(person.id) || 1)
}

function sortHierarchyChildren(
  children: HierarchyPerson[],
  departmentMemberCounts: Map<string, number>,
  subtreeSizes: Map<string, number>,
) {
  return [...children].sort((a, b) => {
    const weightCompare =
      getHierarchyWeight(a, departmentMemberCounts, subtreeSizes) -
      getHierarchyWeight(b, departmentMemberCounts, subtreeSizes)

    return weightCompare || sortPeople(a, b)
  })
}

function EmployeeNode({ data }: NodeProps<Node<EmployeeNodeData>>) {
  const { person } = data
  const t = useTranslations('organization')
  const cardClassName =
    'nodrag nopan flex h-[76px] w-[260px] items-center gap-3 rounded-md border bg-background px-3 text-left shadow-sm transition-shadow'
  const cardContent = (
    <>
      {person.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.photo}
          alt={person.fullName}
          className="h-11 w-11 shrink-0 rounded-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
          {initials(person.fullName)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{person.fullName}</div>
        <div className="truncate text-xs uppercase tracking-normal text-muted-foreground">
          {person.jobTitle || t('noPosition')}
        </div>
        {primaryDepartmentName(person) && (
          <div className="truncate text-[10px] uppercase tracking-normal text-muted-foreground/70 mt-0.5">
            {primaryDepartmentName(person)}
          </div>
        )}
      </div>
    </>
  )

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-0 !bg-transparent"
      />
      {person.canViewProfile ? (
        <Link
          href={`/team-members/${person.id}`}
          className={`${cardClassName} hover:shadow-md`}
          draggable={false}
        >
          {cardContent}
        </Link>
      ) : (
        <div className={cardClassName}>{cardContent}</div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-0 !bg-transparent"
      />
    </div>
  )
}

const employeeNodeTypes = { employee: EmployeeNode }

function buildEffectiveDepartmentManagers(
  departments: EmployeeHierarchyChartProps['departments'],
  peopleById: Map<string, HierarchyPerson>,
  rootDepartmentName: string,
) {
  const safeDepartments = departments || []
  const departmentsById = new Map(safeDepartments.map((department) => [department.id, department]))
  const rootDepartment = safeDepartments.find(
    (department) => department.name === rootDepartmentName,
  )
  const rootManagerId =
    rootDepartment?.managerUserId && peopleById.has(rootDepartment.managerUserId)
      ? rootDepartment.managerUserId
      : null
  const cache = new Map<string, string[]>()

  function resolve(departmentId: string, visited = new Set<string>()): string[] {
    if (cache.has(departmentId)) return cache.get(departmentId) || []
    if (visited.has(departmentId)) return []
    visited.add(departmentId)

    const department = departmentsById.get(departmentId)
    if (!department) return []

    const directManagerIds =
      department.managerUserId && peopleById.has(department.managerUserId)
        ? [department.managerUserId]
        : []
    const inheritedManagerIds = department.parentDepartmentId
      ? resolve(department.parentDepartmentId, visited)
      : department.name !== rootDepartmentName && rootManagerId
        ? [rootManagerId]
        : []
    const managerIds = Array.from(new Set([...directManagerIds, ...inheritedManagerIds]))

    cache.set(departmentId, managerIds)
    return managerIds
  }

  for (const department of safeDepartments) {
    resolve(department.id)
  }

  return cache
}

function getPrimaryDisplayDepartmentId(person: HierarchyPerson) {
  return person.departmentId || null
}

function getPrimaryManagedDepartmentId(
  person: HierarchyPerson,
  managedDepartmentIdsByUserId: Map<string, string[]>,
  departmentsById: Map<string, EmployeeHierarchyChartProps['departments'][number]>,
) {
  const managedDepartmentIds = managedDepartmentIdsByUserId.get(person.id) || []
  if (managedDepartmentIds.length === 0) return null

  const primaryDepartmentId = getPrimaryDisplayDepartmentId(person)
  if (primaryDepartmentId && managedDepartmentIds.includes(primaryDepartmentId)) {
    return primaryDepartmentId
  }

  return [...managedDepartmentIds].sort((a, b) =>
    (departmentsById.get(a)?.name || '').localeCompare(departmentsById.get(b)?.name || ''),
  )[0]
}

function getParentDepartmentManagerId({
  departmentId,
  personId,
  departmentsById,
  effectiveManagersByDepartment,
  rootDepartmentName,
  rootManagerId,
}: {
  departmentId: string | null
  personId: string
  departmentsById: Map<string, EmployeeHierarchyChartProps['departments'][number]>
  effectiveManagersByDepartment: Map<string, string[]>
  rootDepartmentName: string
  rootManagerId: string | null
}) {
  if (!departmentId) return null

  let currentDepartment = departmentsById.get(departmentId)
  const visited = new Set<string>()

  while (
    currentDepartment?.parentDepartmentId &&
    !visited.has(currentDepartment.parentDepartmentId)
  ) {
    visited.add(currentDepartment.parentDepartmentId)
    const managerId = effectiveManagersByDepartment
      .get(currentDepartment.parentDepartmentId)
      ?.find((candidateId) => candidateId !== personId)

    if (managerId) return managerId
    currentDepartment = departmentsById.get(currentDepartment.parentDepartmentId)
  }

  if (
    currentDepartment?.name !== rootDepartmentName &&
    rootManagerId &&
    rootManagerId !== personId
  ) {
    return rootManagerId
  }

  return null
}

function buildChildrenByManager(
  people: HierarchyPerson[],
  departments: EmployeeHierarchyChartProps['departments'],
  rootDepartmentName: string,
) {
  const safeDepartments = departments || []
  const peopleById = new Map(people.map((person) => [person.id, person]))
  const departmentsById = new Map(safeDepartments.map((department) => [department.id, department]))
  const rootDepartment = safeDepartments.find(
    (department) => department.name === rootDepartmentName,
  )
  const root =
    (rootDepartment?.managerUserId ? peopleById.get(rootDepartment.managerUserId) : null) ||
    people.find((person) => person.isProtectedAdmin)
  const rootManagerId = root?.id || null
  const effectiveManagersByDepartment = buildEffectiveDepartmentManagers(
    departments,
    peopleById,
    rootDepartmentName,
  )
  const managedDepartmentIdsByUserId = new Map<string, string[]>()

  for (const department of safeDepartments) {
    if (department.managerUserId && peopleById.has(department.managerUserId)) {
      const managerId = department.managerUserId
      const managedDepartmentIds = managedDepartmentIdsByUserId.get(managerId) || []
      managedDepartmentIds.push(department.id)
      managedDepartmentIdsByUserId.set(managerId, managedDepartmentIds)
    }
  }

  const departmentManagerIds = new Set(managedDepartmentIdsByUserId.keys())
  const childrenByManager = new Map<string, HierarchyPerson[]>()

  for (const person of people) {
    if (person.id === root?.id) continue

    let managerId: string | null = null

    if (departmentManagerIds.has(person.id)) {
      const managedDepartmentId = getPrimaryManagedDepartmentId(
        person,
        managedDepartmentIdsByUserId,
        departmentsById,
      )
      managerId =
        getParentDepartmentManagerId({
          departmentId: managedDepartmentId,
          personId: person.id,
          departmentsById,
          effectiveManagersByDepartment,
          rootDepartmentName,
          rootManagerId,
        }) ||
        root?.id ||
        null
    } else {
      const departmentId = getPrimaryDisplayDepartmentId(person)
      const departmentManagerId = departmentId
        ? effectiveManagersByDepartment
            .get(departmentId)
            ?.find((candidateId) => candidateId !== person.id)
        : null
      managerId = departmentManagerId || null
    }

    if (!managerId) continue

    const existingChildren = childrenByManager.get(managerId) || []
    existingChildren.push(person)
    childrenByManager.set(managerId, existingChildren)
  }

  for (const children of childrenByManager.values()) {
    children.sort(sortPeople)
  }

  return childrenByManager
}

function getVisibleIds({
  people,
  childrenByManager,
  query,
  departmentId,
}: {
  people: HierarchyPerson[]
  childrenByManager: Map<string, HierarchyPerson[]>
  query: string
  departmentId: string
}) {
  const childIds = new Set(
    Array.from(childrenByManager.values())
      .flat()
      .map((person) => person.id),
  )
  const visible = new Set<string>()
  const visited = new Set<string>()

  function visit(person: HierarchyPerson): boolean {
    if (visited.has(person.id)) return visible.has(person.id)
    visited.add(person.id)

    const childMatches = (childrenByManager.get(person.id) || []).some((child) => visit(child))
    const selfMatches = matchesPerson(person, query, departmentId)

    if (selfMatches || childMatches) {
      visible.add(person.id)
      return true
    }

    return false
  }

  for (const person of people.filter((candidate) => !childIds.has(candidate.id))) {
    visit(person)
  }

  for (const person of people) {
    if (!visited.has(person.id)) visit(person)
  }

  return visible
}

type CompactLayout = {
  nodes: Node[]
  edges: Edge[]
  left: number
  right: number
  bottomLevel: number
}

function translateCompactLayout(
  layout: CompactLayout,
  xOffset: number,
  levelOffset: number,
): CompactLayout {
  return {
    nodes: layout.nodes.map((node) => ({
      ...node,
      position: {
        x: node.position.x + xOffset,
        y: node.position.y + levelOffset * Y_GAP,
      },
    })),
    edges: layout.edges,
    left: layout.left + xOffset,
    right: layout.right + xOffset,
    bottomLevel: layout.bottomLevel + levelOffset,
  }
}

function mergeCompactExtents(layouts: CompactLayout[]) {
  return {
    left: Math.min(0, ...layouts.map((layout) => layout.left)),
    right: Math.max(0, ...layouts.map((layout) => layout.right)),
    bottomLevel: Math.max(0, ...layouts.map((layout) => layout.bottomLevel)),
  }
}

function getCompactLayoutWidth(layout: CompactLayout) {
  return Math.max(X_GAP, layout.right - layout.left + X_GAP)
}

function layoutTree({
  root,
  childrenByManager,
  visibleIds,
  departmentMemberCounts,
  subtreeSizes,
  startX,
  nodes,
  edges,
  visited,
}: {
  root: HierarchyPerson
  childrenByManager: Map<string, HierarchyPerson[]>
  visibleIds: Set<string>
  departmentMemberCounts: Map<string, number>
  subtreeSizes: Map<string, number>
  startX: number
  nodes: Node[]
  edges: Edge[]
  visited: Set<string>
}) {
  function buildCompactSubtree(person: HierarchyPerson): CompactLayout {
    visited.add(person.id)
    const children = sortHierarchyChildren(
      (childrenByManager.get(person.id) || []).filter(
        (child) => visibleIds.has(child.id) && !visited.has(child.id),
      ),
      departmentMemberCounts,
      subtreeSizes,
    )

    if (children.length === 0) {
      return {
        nodes: [createNode(person, 0, 0)],
        edges: [],
        left: 0,
        right: 0,
        bottomLevel: 0,
      }
    }

    const childrenAreLeaves = children.every((child) => {
      const childChildren = childrenByManager.get(child.id) || []
      return childChildren.every((grandchild) => !visibleIds.has(grandchild.id))
    })

    if (childrenAreLeaves) {
      const columns = Math.min(MAX_LEAF_COLUMNS, children.length)
      const left = -((columns - 1) * X_GAP) / 2
      const right = ((columns - 1) * X_GAP) / 2
      const childNodes: Node[] = []
      const childEdges: Edge[] = []
      let bottomLevel = 0

      children.forEach((child, index) => {
        const row = Math.floor(index / MAX_LEAF_COLUMNS)
        const rowChildrenCount = Math.min(
          MAX_LEAF_COLUMNS,
          children.length - row * MAX_LEAF_COLUMNS,
        )
        const column = index % MAX_LEAF_COLUMNS
        const rowLeft = -((rowChildrenCount - 1) * X_GAP) / 2
        const childCenter = rowLeft + column * X_GAP

        visited.add(child.id)
        childNodes.push(createNode(child, 1 + row, childCenter))
        childEdges.push(createPrimaryEdge(person.id, child.id))
        bottomLevel = Math.max(bottomLevel, 1 + row)
      })

      return {
        nodes: [createNode(person, 0, 0), ...childNodes],
        edges: childEdges,
        left,
        right,
        bottomLevel,
      }
    }

    const packedChildLayouts: CompactLayout[] = []
    const childEdges: Edge[] = []
    let bandTopLevel = 1

    for (let startIndex = 0; startIndex < children.length; startIndex += MAX_BRANCH_COLUMNS) {
      const bandChildren = children.slice(startIndex, startIndex + MAX_BRANCH_COLUMNS)
      const bandLayouts = bandChildren.map((child) => ({
        child,
        layout: buildCompactSubtree(child),
      }))
      const bandWidths = bandLayouts.map(({ layout }) => getCompactLayoutWidth(layout))
      const bandWidth = bandWidths.reduce((total, width) => total + width, 0)
      let cursor = -bandWidth / 2
      let bandBottomLevel = bandTopLevel

      bandLayouts.forEach(({ child, layout }, column) => {
        const xOffset = cursor - layout.left + X_GAP / 2
        const levelOffset = bandTopLevel + column
        const translatedLayout = translateCompactLayout(layout, xOffset, levelOffset)

        packedChildLayouts.push(translatedLayout)
        childEdges.push(createPrimaryEdge(person.id, child.id))
        bandBottomLevel = Math.max(bandBottomLevel, translatedLayout.bottomLevel)
        cursor += bandWidths[column]
      })

      bandTopLevel = bandBottomLevel + 1
    }

    const extents = mergeCompactExtents(packedChildLayouts)

    return {
      nodes: [createNode(person, 0, 0), ...packedChildLayouts.flatMap((layout) => layout.nodes)],
      edges: [...childEdges, ...packedChildLayouts.flatMap((layout) => layout.edges)],
      left: extents.left,
      right: extents.right,
      bottomLevel: extents.bottomLevel,
    }
  }

  const layout = buildCompactSubtree(root)
  const translatedLayout = translateCompactLayout(layout, startX - layout.left, 0)

  nodes.push(...translatedLayout.nodes)
  edges.push(...translatedLayout.edges)

  return translatedLayout.right + ROOT_GAP
}

function createNode(
  person: HierarchyPerson,
  depth: number,
  centerX: number,
): Node<EmployeeNodeData> {
  return {
    id: person.id,
    type: 'employee',
    data: { person },
    position: {
      x: centerX - NODE_WIDTH / 2,
      y: depth * Y_GAP,
    },
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    draggable: false,
  }
}

function createStandaloneGroupNode(root: HierarchyPerson, subtreeNodes: Node[]): Node {
  const minX = Math.min(...subtreeNodes.map((node) => node.position.x))
  const minY = Math.min(...subtreeNodes.map((node) => node.position.y))
  const maxX = Math.max(...subtreeNodes.map((node) => node.position.x + NODE_WIDTH))
  const maxY = Math.max(...subtreeNodes.map((node) => node.position.y + NODE_HEIGHT))

  return {
    id: `standalone-group-${root.id}`,
    type: 'group',
    position: { x: minX - 44, y: minY - 38 },
    data: { label: '' },
    selectable: false,
    draggable: false,
    zIndex: -1,
    style: {
      width: maxX - minX + 88,
      height: maxY - minY + 76,
      border: '1px dashed #cbd5e1',
      borderRadius: 14,
      backgroundColor: 'rgba(248, 250, 252, 0.72)',
      pointerEvents: 'none',
    },
    ariaLabel: `${root.fullName} standalone group`,
  }
}

function createPrimaryEdge(source: string, target: string): Edge {
  return {
    id: `primary-${source}-${target}`,
    source,
    target,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
    style: { stroke: '#cbd5e1', strokeWidth: 1.5 },
  }
}

function createDottedEdge(source: string, target: string): Edge {
  return {
    id: `dotted-${source}-${target}`,
    source,
    target,
    type: 'smoothstep',
    animated: false,
    style: { stroke: '#94a3b8', strokeDasharray: '6 6', strokeWidth: 1.2 },
  }
}

function usePyramidOrganizationLayout(
  people: HierarchyPerson[],
  query: string,
  departmentId: string,
  rootDepartmentName: string,
  rootManagerId: string | null,
  departments: EmployeeHierarchyChartProps['departments'],
) {
  return React.useMemo(() => {
    const childrenByManager = buildChildrenByManager(people, departments, rootDepartmentName)
    const departmentMemberCounts = buildDepartmentMemberCounts(people, departments)
    const subtreeSizes = buildSubtreeSizes(childrenByManager)
    const visibleIds = getVisibleIds({ people, childrenByManager, query, departmentId })
    const peopleById = new Map(people.map((person) => [person.id, person]))
    const configuredRoot = rootManagerId ? peopleById.get(rootManagerId) : null
    const root =
      (configuredRoot && visibleIds.has(configuredRoot.id) ? configuredRoot : null) ||
      people.find((person) => person.isProtectedAdmin && visibleIds.has(person.id))
    const nodes: Node[] = []
    const edges: Edge[] = []
    const visited = new Set<string>()
    const childIds = new Set(
      Array.from(childrenByManager.values())
        .flat()
        .map((person) => person.id),
    )
    let nextX = 0

    if (root) {
      nextX = layoutTree({
        root,
        childrenByManager,
        visibleIds,
        departmentMemberCounts,
        subtreeSizes,
        startX: 0,
        nodes,
        edges,
        visited,
      })
    }

    const standaloneRoots = people
      .filter((person) => {
        if (!visibleIds.has(person.id)) return false
        if (person.id === root?.id) return false
        if (visited.has(person.id)) return false
        return !childIds.has(person.id)
      })
      .sort((a, b) => {
        const weightCompare =
          getHierarchyWeight(a, departmentMemberCounts, subtreeSizes) -
          getHierarchyWeight(b, departmentMemberCounts, subtreeSizes)

        return weightCompare || sortPeople(a, b)
      })

    for (const standaloneRoot of standaloneRoots) {
      const firstSubtreeNodeIndex = nodes.length
      nextX = layoutTree({
        root: standaloneRoot,
        childrenByManager,
        visibleIds,
        departmentMemberCounts,
        subtreeSizes,
        startX: nextX,
        nodes,
        edges,
        visited,
      })
      const subtreeNodes = nodes.slice(firstSubtreeNodeIndex)
      if (subtreeNodes.length > 0) {
        nodes.splice(
          firstSubtreeNodeIndex,
          0,
          createStandaloneGroupNode(standaloneRoot, subtreeNodes),
        )
      }
    }

    const renderedNodeIds = new Set(nodes.map((node) => node.id))
    for (const person of people) {
      if (!renderedNodeIds.has(person.id)) continue

      for (const manager of person.dottedManagers) {
        if (!renderedNodeIds.has(manager.id)) continue
        edges.push(createDottedEdge(manager.id, person.id))
      }
    }

    return { nodes, edges }
  }, [departmentId, departments, people, query, rootDepartmentName, rootManagerId])
}

function FocusRootOnChange({
  nodes,
  rootManagerId,
}: {
  nodes: Node[]
  rootManagerId: string | null
}) {
  const { setCenter } = useReactFlow()

  React.useEffect(() => {
    const rootNode =
      (rootManagerId ? nodes.find((node) => node.id === rootManagerId) : null) ||
      nodes.find((node) => {
        const data = node.data as Partial<EmployeeNodeData>
        return node.type === 'employee' && Boolean(data.person?.isProtectedAdmin)
      }) ||
      nodes.find((node) => node.type === 'employee')

    if (!rootNode) return

    const frame = requestAnimationFrame(() => {
      setCenter(rootNode.position.x + NODE_WIDTH / 2, rootNode.position.y + NODE_HEIGHT / 2 + 120, {
        zoom: 0.95,
        duration: 350,
      })
    })

    return () => cancelAnimationFrame(frame)
  }, [nodes, rootManagerId, setCenter])

  return null
}

function OrganizationCanvas({
  people,
  departments,
  rootDepartmentName,
  rootManagerId,
}: EmployeeHierarchyChartProps) {
  const t = useTranslations('organization')
  const router = useRouter()
  const [query, setQuery] = React.useState('')
  const [departmentId, setDepartmentId] = React.useState('all')
  const { nodes, edges } = usePyramidOrganizationLayout(
    people,
    query,
    departmentId,
    rootDepartmentName,
    rootManagerId,
    departments,
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 flex-col gap-3 border-b bg-background px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              className="pl-8 sm:w-80"
            />
          </div>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder={t('allDepartments')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allDepartments')}</SelectItem>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(query || departmentId !== 'all') && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQuery('')
                setDepartmentId('all')
              }}
            >
              {t('clearFilters')}
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 bg-white dark:bg-background">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={employeeNodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          onNodeClick={(_event, node) => {
            const data = node.data as Partial<EmployeeNodeData>
            if (node.type === 'employee' && data.person?.canViewProfile) {
              router.push(`/team-members/${data.person.id}`)
            }
          }}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick={false}
          minZoom={0.2}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
          className="organization-whiteboard"
        >
          <FocusRootOnChange nodes={nodes} rootManagerId={rootManagerId} />
          <Background color="#d7dee8" gap={20} size={1} variant={BackgroundVariant.Dots} />
          <Controls showInteractive={false} position="bottom-left" />
        </ReactFlow>
      </div>
    </div>
  )
}

export function EmployeeHierarchyChart(props: EmployeeHierarchyChartProps) {
  return (
    <ReactFlowProvider>
      <OrganizationCanvas
        people={props.people}
        departments={props.departments || []}
        rootDepartmentName={props.rootDepartmentName}
        rootManagerId={props.rootManagerId}
      />
    </ReactFlowProvider>
  )
}

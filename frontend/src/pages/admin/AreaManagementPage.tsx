import { useState } from 'react'
import { Plus, Pencil, PowerOff, Power, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AreaFormModal } from '@/components/admin/AreaFormModal'
import {
  useAdminAreas,
  useCreateArea,
  useUpdateArea,
  useToggleAreaStatus,
} from '@/features/admin/hooks/useAdminAreas'
import type { AreaRecord, CreateAreaPayload } from '@/api/areas.api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function MembershipBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    Silver: 'bg-slate-100 text-slate-700',
    Gold: 'bg-yellow-100 text-yellow-800',
    VIP: 'bg-purple-100 text-purple-800',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[tier] ?? ''}`}>
      {tier}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  return status === 'Active' ? (
    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Activa</Badge>
  ) : (
    <Badge variant="secondary">Inactiva</Badge>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AreaManagementPage() {
  const { data: areas, isLoading, isError } = useAdminAreas()
  const createArea = useCreateArea()
  const updateArea = useUpdateArea()
  const toggleStatus = useToggleAreaStatus()

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AreaRecord | null>(null)

  function handleCreate(payload: CreateAreaPayload) {
    createArea.mutate(payload, { onSuccess: () => setCreateOpen(false) })
  }

  function handleUpdate(payload: CreateAreaPayload) {
    if (!editTarget) return
    updateArea.mutate(
      { areaId: editTarget.areaId, payload },
      { onSuccess: () => setEditTarget(null) }
    )
  }

  function handleToggle(area: AreaRecord) {
    const next = area.status === 'Active' ? 'Inactive' : 'Active'
    toggleStatus.mutate({ areaId: area.areaId, status: next })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de áreas</h1>
          <p className="text-sm text-muted-foreground">
            Configurá las áreas disponibles para reservas
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva área
        </Button>
      </div>

      {/* States */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          No se pudieron cargar las áreas. Intentá recargar la página.
        </div>
      )}

      {/* Areas table */}
      {areas && areas.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          No hay áreas registradas. Creá la primera.
        </p>
      )}

      {areas && areas.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Áreas registradas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Capacidad</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Horario</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Membresías</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {areas.map((area, idx) => (
                    <tr
                      key={area.areaId}
                      className={`border-b last:border-0 ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}
                    >
                      <td className="px-4 py-3 font-medium">{area.name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={area.status} />
                      </td>
                      <td className="px-4 py-3">{area.capacity} personas</td>
                      <td className="px-4 py-3 tabular-nums">
                        {area.openingTime} – {area.closingTime}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {area.allowedMemberships.map((m) => (
                            <MembershipBadge key={m} tier={m} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditTarget(area)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Editar</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggle(area)}
                            disabled={toggleStatus.isPending}
                            title={area.status === 'Active' ? 'Desactivar' : 'Activar'}
                          >
                            {area.status === 'Active' ? (
                              <PowerOff className="h-3.5 w-3.5 text-destructive" />
                            ) : (
                              <Power className="h-3.5 w-3.5 text-emerald-600" />
                            )}
                            <span className="sr-only">
                              {area.status === 'Active' ? 'Desactivar' : 'Activar'}
                            </span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create modal */}
      <AreaFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        isLoading={createArea.isPending}
      />

      {/* Edit modal */}
      <AreaFormModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={handleUpdate}
        isLoading={updateArea.isPending}
        area={editTarget ?? undefined}
      />
    </div>
  )
}

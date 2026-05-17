import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  adminListAllAreas,
  adminCreateArea,
  adminUpdateArea,
  adminToggleAreaStatus,
  type CreateAreaPayload,
  type UpdateAreaPayload,
} from '@/api/areas.api'
import { toast } from '@/hooks/useToast'

const QUERY_KEY = ['admin-areas']

export function useAdminAreas() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await adminListAllAreas()
      return res.data.data
    },
    staleTime: 1000 * 30,
  })
}

function handleError(error: unknown, fallback: string) {
  const msg = isAxiosError(error)
    ? (error.response?.data?.error?.message as string | undefined) ?? fallback
    : fallback
  toast({ title: 'Error', description: msg, variant: 'destructive' })
}

export function useCreateArea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateAreaPayload) => {
      const res = await adminCreateArea(payload)
      return res.data.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY })
      toast({ title: 'Área creada', description: 'El área fue creada correctamente.' })
    },
    onError: (err) => handleError(err, 'No se pudo crear el área.'),
  })
}

export function useUpdateArea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ areaId, payload }: { areaId: string; payload: UpdateAreaPayload }) => {
      const res = await adminUpdateArea(areaId, payload)
      return res.data.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY })
      void qc.invalidateQueries({ queryKey: ['areas'] })
      toast({ title: 'Área actualizada', description: 'Los cambios se guardaron correctamente.' })
    },
    onError: (err) => handleError(err, 'No se pudo actualizar el área.'),
  })
}

export function useToggleAreaStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ areaId, status }: { areaId: string; status: 'Active' | 'Inactive' }) => {
      const res = await adminToggleAreaStatus(areaId, status)
      return res.data.data
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY })
      void qc.invalidateQueries({ queryKey: ['areas'] })
      const label = vars.status === 'Active' ? 'activada' : 'desactivada'
      toast({ title: `Área ${label}`, description: `El estado del área fue actualizado.` })
    },
    onError: (err) => handleError(err, 'No se pudo cambiar el estado del área.'),
  })
}

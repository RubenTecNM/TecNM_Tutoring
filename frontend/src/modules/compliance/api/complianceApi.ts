import { http } from '@/shared/api/http';
import type { Deliverable } from '../types/compliance';

export const complianceApi = {
  async getDeliverablesByDocente(docenteClave: string, periodoId: number): Promise<Deliverable[]> {
    const { data } = await http.get<Deliverable[]>(`/compliance/${docenteClave}/${periodoId}`);
    return data;
  },
  
  async uploadDeliverable(deliverableId: string, file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    await http.post(`/compliance/${deliverableId}/upload`, formData);
  }
};
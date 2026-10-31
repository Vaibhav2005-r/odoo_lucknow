import { useQuery } from '@tanstack/react-query';
import { api } from './api';

// Who we are (printed on invoices) and the GST state list. Never changes while the app is open.
export function useCompany() {
  return useQuery({
    queryKey: ['company'],
    queryFn: async () => (await api.get('/company')).data,
    staleTime: Infinity,
  });
}

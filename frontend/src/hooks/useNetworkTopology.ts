import { useQuery } from '@tanstack/react-query';
import { getNetworkTopology } from '../services/api';

export function useNetworkTopology() {
  return useQuery({
    queryKey: ['network', 'net1'],
    queryFn: getNetworkTopology,
    staleTime: Infinity, // Topology doesn't change often
  });
}

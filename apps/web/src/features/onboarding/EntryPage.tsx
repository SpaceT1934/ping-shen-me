import { Navigate } from 'react-router-dom';
import { useGarden } from '../../app/garden-context';
import { HomePage } from '../home/HomePage';

export function EntryPage() {
  const { hasStarted } = useGarden();
  return hasStarted ? <HomePage /> : <Navigate to="/welcome" replace />;
}

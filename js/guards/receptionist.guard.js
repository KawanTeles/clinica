import { PermissionsService } from '../permissions.service.js';

export function receptionistGuard() {
  if (!PermissionsService.hasRole('Recepcionista') && !PermissionsService.hasRole('Owner')) {
    window.location.href = '/pages/crm/dashboard.html?erro=acesso_negado';
    return false;
  }
  return true;
}

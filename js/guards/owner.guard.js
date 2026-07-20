import { PermissionsService } from '../permissions.service.js';

export function ownerGuard() {
  if (!PermissionsService.hasRole('Owner')) {
    window.location.href = '/pages/crm/dashboard.html?erro=acesso_negado';
    return false;
  }
  return true;
}

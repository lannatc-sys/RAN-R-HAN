import { getAllStoresAction } from '@/app/actions/superadmin';
import { StoresManagementClient } from './StoresManagementClient';

export default async function SuperadminStoresPage() {
  const { stores } = await getAllStoresAction();

  return <StoresManagementClient initialStores={stores || []} />;
}

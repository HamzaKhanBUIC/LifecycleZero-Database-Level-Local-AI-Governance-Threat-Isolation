'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/auth';
import { currentUser } from '@clerk/nextjs/server';
import { updateAssetStatusTransaction } from '@/lib/dao';
import { HardwareAsset } from '@/lib/types';

export async function updateAssetStatusAction(params: {
  assetId: string;
  newStatus: HardwareAsset['Status'];
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  action: string;
  details: string;
}) {
  try {
    const { tenantId, userId } = await getTenantContext();
    const user = await currentUser();
    const userName = user ? `${user.firstName} ${user.lastName}` : userId || "System Admin";

    await updateAssetStatusTransaction({
      tenantId,
      assetId: params.assetId,
      newStatus: params.newStatus,
      assignedEmployeeId: params.assignedEmployeeId,
      assignedEmployeeName: params.assignedEmployeeName,
      actorId: userId || "SYSTEM",
      actorName: userName,
      action: params.action,
      details: params.details
    });

    revalidatePath(`/dashboard/assets/${params.assetId}`);
    revalidatePath('/dashboard/assets');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error("❌ updateAssetStatusAction Error:", error);
    return { success: false, error: error.message };
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/auth';
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
    let userName = "Demo Administrator";

    // Only load Clerk currentUser when explicitly enabled with a valid key
    const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    if (
      process.env.NEXT_PUBLIC_SKIP_CLERK !== "true" &&
      pubKey?.startsWith("pk_")
    ) {
      const { currentUser } = await import('@clerk/nextjs/server');
      const user = await currentUser();
      if (user) {
        userName = `${user.firstName} ${user.lastName}`;
      }
    }

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

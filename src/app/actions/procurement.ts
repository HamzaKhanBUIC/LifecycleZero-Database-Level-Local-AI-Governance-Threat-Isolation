'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/auth';
import { submitProcurementRequest, resolveProcurementRequest } from '@/lib/dao';
import { ProcurementRequest } from '@/lib/types';

// Only load Clerk currentUser when explicitly enabled with a valid key
async function getActorName(userId: string | null | undefined): Promise<string> {
  const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (
    process.env.NEXT_PUBLIC_SKIP_CLERK !== "true" &&
    pubKey?.startsWith("pk_")
  ) {
    const { currentUser } = await import('@clerk/nextjs/server');
    const user = await currentUser();
    if (user) return `${user.firstName} ${user.lastName}`;
  }
  return "Demo Administrator";
}

export async function createRequestAction(data: {
  assetName: string;
  type: ProcurementRequest['Type'];
  department: string;
}) {
  try {
    const { tenantId, userId } = await getTenantContext();
    const userName = await getActorName(userId);
    const requestId = `REQ-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    await submitProcurementRequest(tenantId, {
      RequestId: requestId,
      RequesterId: userId || "SYSTEM",
      RequesterName: userName,
      AssetName: data.assetName,
      Type: data.type,
      Department: data.department
    });

    revalidatePath('/dashboard/procurement');
    revalidatePath('/dashboard');
    return { success: true, requestId };
  } catch (error: any) {
    console.error("❌ createRequestAction Error:", error);
    return { success: false, error: error.message };
  }
}

export async function resolveRequestAction(requestId: string, decision: 'APPROVED' | 'REJECTED') {
  try {
    const { tenantId, userId } = await getTenantContext();
    const userName = await getActorName(userId);

    const result = await resolveProcurementRequest(
      tenantId,
      requestId,
      decision,
      userId || "SYSTEM",
      userName
    );

    revalidatePath('/dashboard/procurement');
    revalidatePath('/dashboard/assets');
    revalidatePath('/dashboard');
    return { success: true, ...result };
  } catch (error: any) {
    console.error("❌ resolveRequestAction Error:", error);
    return { success: false, error: error.message };
  }
}

'use server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendWebPushToUser(userId: string, payload: { title: string; body: string; url?: string }) {
  try {
    const { data: subs, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (error || !subs || subs.length === 0) return false;

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      data: { url: payload.url || '/dashboard' }
    });

    const sendPromises = subs.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, pushPayload);
      } catch (err: any) {
        // ลบข้อมูลทิ้งถ้าอุปกรณ์นั้นยกเลิกรับการแจ้งเตือนแล้ว
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
        console.error('Push error:', err);
      }
    });

    await Promise.all(sendPromises);
    return true;
  } catch (err) {
    console.error('Error sending push:', err);
    return false;
  }
}

export async function broadcastWebPush(payload: { title: string; body: string; url?: string }) {
  try {
    const { data: subs, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth');

    if (error || !subs || subs.length === 0) return { success: false, sentCount: 0 };

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      data: { url: payload.url || '/dashboard' }
    });

    let sentCount = 0;
    const sendPromises = subs.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, pushPayload);
        sentCount++;
      } catch (err: any) {
        console.error('Push Error for endpoint:', sub.endpoint, err);
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
    });

    await Promise.all(sendPromises);
    return { success: true, sentCount };
  } catch (err) {
    console.error('Error broadcasting push:', err);
    return { success: false, sentCount: 0 };
  }
}

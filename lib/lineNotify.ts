// app/lib/lineNotify.ts
'use server';

export async function sendLineAdmin(message: string) {
  // ดึงค่าจาก Environment Variables
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const adminUserId = process.env.LINE_ADMIN_USER_ID; // UID ของแอดมินที่ต้องการให้แจ้งเตือน

  if (!channelAccessToken || !adminUserId) {
    console.warn("LINE API config is missing. Message not sent.");
    return false;
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelAccessToken}`
      },
      body: JSON.stringify({
        to: adminUserId,
        messages: [
          {
            type: 'text',
            text: message
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("LINE API Error:", errorData);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Failed to send LINE message:", error);
    return false;
  }
}
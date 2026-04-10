import * as React from 'react';

interface ReminderEmailProps {
  userName: string;
  productName: string;
  targetDateString: string;
  price: number;
}

export const ReminderEmail: React.FC<Readonly<ReminderEmailProps>> = ({
  userName,
  productName,
  targetDateString,
  price,
}) => (
  // พื้นหลังด้านนอกใช้สีฟ้าน้ำทะเลอ่อนๆ ให้ดูสบายตา
  <div style={{ backgroundColor: '#F0F7F8', padding: '40px 10px', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
    
    {/* ตัวการ์ดอีเมลขอบมนแบบ Modern UI */}
    <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
      
      {/* 1. Header (ธีมหลัก: พื้นดำ-ตัวอักษรฟ้าพาสเทล) */}
      <div style={{ backgroundColor: '#111827', padding: '30px', textAlign: 'center' }}>
        <h1 style={{ color: '#BCE2E8', margin: 0, fontSize: '28px', letterSpacing: '2px', fontWeight: '900' }}>
          CODARY SUB
        </h1>
      </div>

      <div style={{ padding: '40px 30px' }}>
        {/* 2. คำทักทาย */}
        <h2 style={{ color: '#111827', marginTop: 0, fontSize: '20px' }}>สวัสดีคุณ {userName} 💙</h2>
        <p style={{ color: '#4B5563', fontSize: '16px', lineHeight: '1.6', margin: '0 0 25px 0' }}>
          แพ็กเกจ <strong>{productName}</strong> ของคุณกำลังจะครบกำหนดชำระแล้วค่ะ เพื่อการใช้งานที่ต่อเนื่องและไม่สะดุด อย่าลืมดำเนินการต่ออายุนะคะ
        </p>

        {/* 3. กล่องไฮไลต์ยอดเงิน (กรอบสีฟ้าพาสเทล) */}
        <div style={{ backgroundColor: '#FAFDFF', border: '2px solid #BCE2E8', borderRadius: '12px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' }}>
          <div>
            <p style={{ margin: 0, color: '#6B7280', fontSize: '13px', textTransform: 'uppercase', fontWeight: 'bold' }}>วันครบกำหนด</p>
            <p style={{ margin: '5px 0 0 0', color: '#EF4444', fontSize: '18px', fontWeight: 'bold' }}>{targetDateString}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, color: '#6B7280', fontSize: '13px', textTransform: 'uppercase', fontWeight: 'bold' }}>ยอดชำระ</p>
            <p style={{ margin: '5px 0 0 0', color: '#111827', fontSize: '28px', fontWeight: '900' }}>฿{price}</p>
          </div>
        </div>

        {/* 4. รายละเอียดใบแจ้งยอด (เส้นประใช้สีฟ้าพาสเทล) */}
        <h3 style={{ color: '#111827', fontSize: '16px', margin: '0 0 15px 0' }}>สรุปรายการ (Order Summary)</h3>
        <div style={{ borderTop: '2px dashed #BCE2E8', margin: '15px 0' }}></div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px 0', color: '#1F2937', fontWeight: 'bold', fontSize: '16px' }}>1x {productName}</td>
              <td style={{ padding: '8px 0', color: '#111827', textAlign: 'right', fontWeight: 'bold', fontSize: '16px' }}>฿{price}</td>
            </tr>
            <tr>
              <td style={{ padding: '0 0 10px 0', color: '#6B7280', fontSize: '14px' }}>ค่าบริการต่ออายุ 1 เดือน</td>
              <td style={{ padding: '0 0 10px 0', textAlign: 'right' }}></td>
            </tr>
          </tbody>
        </table>

        <div style={{ borderTop: '2px dashed #BCE2E8', margin: '15px 0' }}></div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px 0', color: '#111827', fontWeight: 'bold', fontSize: '18px' }}>ยอดสุทธิ</td>
              <td style={{ padding: '8px 0', color: '#111827', textAlign: 'right', fontWeight: '900', fontSize: '22px' }}>฿{price}</td>
            </tr>
          </tbody>
        </table>

        {/* 5. ปุ่ม CTA (พื้นดำ-อักษรฟ้าพาสเทล) */}
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <a 
            href="https://yourwebsite.com/login" 
            style={{ display: 'inline-block', backgroundColor: '#111827', color: '#BCE2E8', padding: '16px 40px', borderRadius: '12px', textDecoration: 'none', fontWeight: 'bold', fontSize: '16px', letterSpacing: '0.5px', boxShadow: '0 4px 12px rgba(17, 24, 39, 0.15)' }}
          >
            ชำระเงินต่ออายุแพ็กเกจ
          </a>
        </div>
      </div>

      {/* 6. Footer แบบคลีนๆ */}
      <div style={{ backgroundColor: '#F9FAFB', padding: '20px 30px', textAlign: 'center', borderTop: '1px solid #E5E7EB' }}>
        <p style={{ margin: '0 0 8px 0', color: '#6B7280', fontSize: '13px' }}>หากคุณดำเนินการชำระเงินเรียบร้อยแล้ว โปรดละเว้นอีเมลฉบับนี้</p>
        <p style={{ margin: 0, color: '#9CA3AF', fontSize: '12px' }}>© 2026 Codary Sub. All rights reserved.</p>
      </div>

    </div>
  </div>
);
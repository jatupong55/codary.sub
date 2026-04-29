// components/admin/InventoryModal.tsx
'use client';

import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import type { Product, InventoryFormData, InventoryDetailsData } from '@/types/admin';

interface InventoryModalProps {
  isOpen: boolean;
  isAnimating: boolean;
  editId: string | null;
  formData: InventoryFormData;
  editDetails: InventoryDetailsData;
  products: Product[];
  isProcessing: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  onFormChange: (updated: InventoryFormData) => void;
  onDetailsChange: (updated: InventoryDetailsData) => void;
}

export default function InventoryModal({
  isOpen,
  isAnimating,
  editId,
  formData,
  editDetails,
  products,
  isProcessing,
  onClose,
  onSave,
  onFormChange,
  onDetailsChange,
}: InventoryModalProps) {
  if (!isOpen) return null;

  const selectedProduct = products.find((p) => p.id === formData.product_id);
  const isSpotify = selectedProduct?.category?.toLowerCase().trim() === 'spotify';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all duration-300 ease-in-out ${
          isAnimating ? 'scale-100 translate-y-0' : 'scale-95 translate-y-8'
        }`}
      >
        {/* Header */}
        <div className="relative px-6 py-5 flex justify-between items-center bg-gradient-to-r from-[#BCE2E8]/40 via-white to-[#BCE2E8]/20 border-b border-[#BCE2E8]/30 overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/60 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#BCE2E8]/50 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none" />
          <h3 className="text-lg font-bold text-gray-800 tracking-wide relative z-10 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#8ABAC2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {editId ? 'แก้ไขข้อมูลบ้าน' : 'เพิ่มบ้านใหม่'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/60 text-gray-500 hover:bg-white hover:text-gray-800 hover:shadow-sm transition-all"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* แพ็กเกจสินค้า */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">แพ็กเกจสินค้า</label>
            <select
              required
              value={formData.product_id}
              onChange={(e) => onFormChange({ ...formData, product_id: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-colors"
            >
              <option value="" disabled>-- เลือกแพ็กเกจ --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
              ))}
            </select>
          </div>

          {/* อีเมล */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">อีเมลบ้าน (Master Account Email)</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => onFormChange({ ...formData, email: e.target.value })}
              placeholder="เช่น spotify_family1@gmail.com"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-all"
            />
          </div>

          {/* รหัสผ่าน + Slots */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">รหัสผ่าน (ถ้ามี)</label>
              <input
                type="text"
                value={formData.password}
                onChange={(e) => onFormChange({ ...formData, password: e.target.value })}
                placeholder="รหัสผ่านเข้าเมล"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">โควตาสูงสุด (Slots)</label>
              <input
                type="number"
                min="1"
                required
                value={formData.max_slots}
                onChange={(e) => onFormChange({ ...formData, max_slots: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-all"
              />
            </div>
          </div>

          {/* ต้นทุน + รอบบิล */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">ต้นทุน/รอบ (บาท)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.cost}
                onChange={(e) => onFormChange({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                placeholder="เช่น 180.00"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">รอบบิลของบ้าน</label>
              <select
                value={formData.billing_cycle}
                onChange={(e) => onFormChange({ ...formData, billing_cycle: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-colors"
              >
                <option value="monthly">รายเดือน</option>
                <option value="yearly">รายปี</option>
              </select>
            </div>
          </div>

          {/* DatePicker วันต่ออายุ */}
          <div className="relative z-[100]">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex justify-between">
              <span>กำหนดวันต่ออายุแพ็กเกจหลัก</span>
              <span className="text-xs text-gray-400 font-normal">ไม่ต้องกรอกก็ได้</span>
            </label>
            <DatePicker
              selected={formData.next_renewal_date ? new Date(formData.next_renewal_date) : null}
              onChange={(date: Date | null) => {
                onFormChange({
                  ...formData,
                  next_renewal_date: date ? format(date, 'yyyy-MM-dd') : '',
                });
              }}
              dateFormat="dd/MM/yyyy"
              locale={th}
              placeholderText="วัน/เดือน/ปี"
              isClearable
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-all"
              wrapperClassName="w-full"
            />
            <p className="text-[10px] text-gray-400 mt-1">ใช้เพื่อเตือนแอดมินว่าต้องนำเงินไปจ่ายต้นทางเมื่อไหร่</p>
          </div>

          {/* Details (Spotify vs อื่นๆ) */}
          <div className="pt-2 border-t border-gray-100 mt-4">
            <h4 className="text-xs font-bold text-blue-600 mb-3 uppercase tracking-wider">ข้อมูลเพิ่มเติม (Details)</h4>

            {isSpotify ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">ที่อยู่ครอบครัว</label>
                  <input
                    type="text"
                    placeholder="กรอกที่อยู่สำหรับยืนยันตัวตน"
                    value={editDetails.address}
                    onChange={(e) => onDetailsChange({ ...editDetails, address: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">ลิงก์คำเชิญ (Invite Link)</label>
                  <input
                    type="text"
                    placeholder="https://www.spotify.com/th/family/join/..."
                    value={editDetails.inviteLink}
                    onChange={(e) => onDetailsChange({ ...editDetails, inviteLink: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-blue-400 outline-none"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">หมายเหตุถึงลูกค้า (Note)</label>
                <textarea
                  placeholder="คำแนะนำ หรือข้อมูลการเข้าสู่ระบบ..."
                  value={editDetails.note}
                  onChange={(e) => onDetailsChange({ ...editDetails, note: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-blue-400 outline-none h-16 resize-none"
                />
              </div>
            )}
          </div>

          {/* สถานะบัญชี */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">สถานะบัญชี</label>
            <select
              value={formData.status}
              onChange={(e) => onFormChange({ ...formData, status: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-800 outline-none transition-colors"
            >
              <option value="active">เปิดใช้งาน (Active)</option>
              <option value="disabled">ระงับชั่วคราว (Disabled)</option>
            </select>
          </div>

          {/* Actions */}
          <div className="pt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-gray-50 border-2 border-gray-300 text-gray-700 font-bold rounded-2xl hover:bg-gray-100 hover:border-gray-400 transition-all active:scale-95 text-sm"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isProcessing || !formData.product_id}
              className={`flex-[1.5] py-3 px-4 font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-sm shadow-lg ${
                isProcessing || !formData.product_id
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                : 'bg-[#CCF0D4] text-[#166534] hover:bg-[#B5EAC0] shadow-green-100 border border-green-200/50'
              }`}
            >
              {isProcessing ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              )}
              {isProcessing ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

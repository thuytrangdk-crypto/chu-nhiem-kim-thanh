import React, { useState, useEffect } from 'react';
import { School, Calendar, User, BookOpen, X, Check, Sparkles } from 'lucide-react';

interface QuickEditSchoolModalProps {
  isOpen: boolean;
  schoolName: string;
  className: string;
  schoolYear: string;
  teacherName: string;
  onSave: (data: {
    schoolName: string;
    className: string;
    schoolYear: string;
    teacherName: string;
  }) => void;
  onClose: () => void;
}

export const QuickEditSchoolModal: React.FC<QuickEditSchoolModalProps> = ({
  isOpen,
  schoolName,
  className,
  schoolYear,
  teacherName,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState({
    schoolName,
    className,
    schoolYear,
    teacherName,
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        schoolName,
        className,
        schoolYear,
        teacherName,
      });
    }
  }, [isOpen, schoolName, className, schoolYear, teacherName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.className.trim()) return;
    onSave({
      schoolName: formData.schoolName.trim() || 'Trường THCS Chu Văn An',
      className: formData.className.trim(),
      schoolYear: formData.schoolYear.trim() || '2024 - 2025',
      teacherName: formData.teacherName.trim() || 'Cô Lê Thị Kim Thanh',
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#E5B2BD]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Light Pink Theme (Màu hồng pastel #EDB5C1 thanh lịch) */}
        <div className="bg-linear-to-r from-[#FCF4F6] via-[#FAF0F3] to-[#F8E2E7] p-6 text-gray-900 border-b border-[#E5B2BD] relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl bg-white/90 hover:bg-white text-gray-600 hover:text-gray-900 border border-[#EDB5C1]/60 shadow-2xs transition-all cursor-pointer"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white text-[#1E293B] flex items-center justify-center border border-[#EDB5C1] shadow-xs ring-2 ring-[#FCF4F6]">
              <School className="w-6 h-6 text-[#1E293B]" />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight text-[#1E293B] flex items-center gap-2">
                <span>Chỉnh Sửa Thông Tin Bên Ngoài</span>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </h3>
              <p className="text-xs text-slate-700 mt-0.5 font-medium">
                Dành cho Giáo viên Chủ nhiệm tùy chỉnh linh động tên trường, lớp và năm học
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-[#FCF4F6]/30">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-[#C98292]" />
              <span>Tên Trường Học *</span>
            </label>
            <input
              type="text"
              required
              value={formData.schoolName}
              onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
              placeholder="VD: Trường THCS Chu Văn An"
              className="w-full px-4 py-3 bg-white border border-[#EDB5C1]/70 rounded-2xl text-sm font-semibold text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] focus:border-[#EDB5C1] transition-all shadow-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#C98292]" />
                <span>Tên Lớp Chủ Nhiệm *</span>
              </label>
              <input
                type="text"
                required
                value={formData.className}
                onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                placeholder="VD: 8A3"
                className="w-full px-4 py-3 bg-white border border-[#EDB5C1]/70 rounded-2xl text-sm font-bold text-[#1E293B] placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] focus:border-[#EDB5C1] transition-all shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#C98292]" />
                <span>Năm Học *</span>
              </label>
              <input
                type="text"
                required
                value={formData.schoolYear}
                onChange={(e) => setFormData({ ...formData, schoolYear: e.target.value })}
                placeholder="VD: 2024 - 2025"
                className="w-full px-4 py-3 bg-white border border-[#EDB5C1]/70 rounded-2xl text-sm font-semibold text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] focus:border-[#EDB5C1] transition-all shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#C98292]" />
              <span>Họ Tên Giáo Viên Chủ Nhiệm *</span>
            </label>
            <input
              type="text"
              required
              value={formData.teacherName}
              onChange={(e) => setFormData({ ...formData, teacherName: e.target.value })}
              placeholder="VD: Cô Lê Thị Kim Thanh"
              className="w-full px-4 py-3 bg-white border border-[#EDB5C1]/70 rounded-2xl text-sm font-semibold text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] focus:border-[#EDB5C1] transition-all shadow-xs"
            />
          </div>

          <div className="pt-3 border-t border-[#EDB5C1]/40 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-black bg-[#EDB5C1] hover:bg-[#E4A7B4] active:scale-95 text-[#1E293B] shadow-md shadow-[#EDB5C1]/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 text-[#1E293B]" />
              <span>Lưu Thông Tin Ngay</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

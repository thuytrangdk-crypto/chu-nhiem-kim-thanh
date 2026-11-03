import React, { useState } from 'react';
import { Layers, School, Calendar, User, X, Check } from 'lucide-react';

interface ClassSwitchModalProps {
  isOpen: boolean;
  schoolName?: string;
  currentClass: string;
  currentYear: string;
  teacherName: string;
  availableClasses: string[];
  onSave: (data: {
    schoolName?: string;
    className: string;
    schoolYear: string;
    teacherName: string;
    availableClasses: string[];
  }) => void;
  onClose: () => void;
}

export const ClassSwitchModal: React.FC<ClassSwitchModalProps> = ({
  isOpen,
  schoolName = 'Trường THCS Chu Văn An',
  currentClass,
  currentYear,
  teacherName,
  availableClasses = ['8A3', '9A5', '7A1', '6A2'],
  onSave,
  onClose,
}) => {
  const [selectedClass, setSelectedClass] = useState(currentClass);
  const [customClass, setCustomClass] = useState('');
  const [school, setSchool] = useState(schoolName);
  const [schoolYear, setSchoolYear] = useState(currentYear);
  const [teacher, setTeacher] = useState(teacherName);
  const [classList, setClassList] = useState<string[]>(availableClasses);

  if (!isOpen) return null;

  const handleSelectPredefined = (cls: string) => {
    setSelectedClass(cls);
    setCustomClass('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalClassName = (customClass.trim() || selectedClass.trim()).toUpperCase();
    if (!finalClassName) return;

    let updatedClasses = [...classList];
    if (!updatedClasses.includes(finalClassName)) {
      updatedClasses.push(finalClassName);
    }

    onSave({
      schoolName: school.trim(),
      className: finalClassName,
      schoolYear: schoolYear.trim(),
      teacherName: teacher.trim(),
      availableClasses: updatedClasses,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#E5B2BD] flex items-center justify-between bg-[#EDB5C1] text-[#1E293B]">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#1E293B]" />
            <h3 className="font-black text-base">Chuyển Đổi Lớp Học & Năm Học</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#1E293B] hover:text-black font-black cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Tên Trường Học
            </label>
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="Trường THCS Chu Văn An"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
              Chọn Lớp Chủ Nhiệm
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {classList.map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => handleSelectPredefined(cls)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-between cursor-pointer ${
                    selectedClass === cls && !customClass
                      ? 'bg-[#FCF4F6] border-[#EDB5C1] text-[#1E293B] shadow-xs'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>Lớp {cls}</span>
                  {selectedClass === cls && !customClass && (
                    <Check className="w-3.5 h-3.5 text-[#1E293B]" />
                  )}
                </button>
              ))}
            </div>

            <div className="mt-2">
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                Hoặc nhập tên lớp khác:
              </label>
              <input
                type="text"
                value={customClass}
                onChange={(e) => {
                  setCustomClass(e.target.value);
                  setSelectedClass(e.target.value);
                }}
                placeholder="VD: 8A4, 9B1..."
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] font-bold uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Năm Học
            </label>
            <input
              type="text"
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              placeholder="2024 - 2025"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Giáo Viên Chủ Nhiệm
            </label>
            <input
              type="text"
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
              placeholder="VD: Cô Lê Thị Kim Thanh"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]"
            />
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#EDB5C1] hover:bg-[#E4A7B4] text-[#1E293B] text-xs font-black shadow-md shadow-[#EDB5C1]/20 cursor-pointer"
            >
              Chuyển Lớp
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

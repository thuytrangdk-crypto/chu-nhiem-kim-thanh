import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Calendar,
  X,
  Clock,
  School,
  UserCheck,
  Award,
  AlertCircle,
  CheckCircle2,
  Download,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { AppState } from '../types';
import { formatViDate, getTodayStr } from '../utils/helpers';
import {
  EmulationPeriodInfo,
  calculateEmulationData,
  exportEmulationToExcel,
} from '../utils/emulationExport';

interface EmulationExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

type PeriodType = 'week' | 'month' | 'semester' | 'year' | 'custom';

export const EmulationExportModal: React.FC<EmulationExportModalProps> = ({
  isOpen,
  onClose,
  state,
  onShowToast,
}) => {
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [isExporting, setIsExporting] = useState(false);

  // Parse current school year
  const schoolYear = state.config.schoolYear || '2024 - 2025';
  const yearMatch = schoolYear.match(/(\d{4})\s*[-–]\s*(\d{4})/);
  const startYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
  const endYear = yearMatch ? parseInt(yearMatch[2]) : startYear + 1;

  const today = getTodayStr(); // YYYY-MM-DD
  const currentMonth = today.substring(0, 7); // YYYY-MM

  // States for sub-options
  const [selectedWeekType, setSelectedWeekType] = useState<'this_week' | 'last_week' | 'pick_date'>('this_week');
  const [pickedWeekDate, setPickedWeekDate] = useState<string>(today);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);

  const [selectedSemester, setSelectedSemester] = useState<'hk1' | 'hk2'>('hk1');

  const [customStartDate, setCustomStartDate] = useState<string>(
    `${today.substring(0, 7)}-01`
  );
  const [customEndDate, setCustomEndDate] = useState<string>(today);

  // Compute Week Range (Monday to Sunday)
  const getWeekRange = (dateStr: string): { start: string; end: string } => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay(); // 0 is Sunday, 1 is Monday
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const formatYMD = (dateObj: Date) => {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dayNum = String(dateObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${dayNum}`;
    };

    return {
      start: formatYMD(monday),
      end: formatYMD(sunday),
    };
  };

  // Compute active period info based on user choice
  const periodInfo: EmulationPeriodInfo = useMemo(() => {
    if (periodType === 'week') {
      if (selectedWeekType === 'this_week') {
        const { start, end } = getWeekRange(today);
        return {
          type: 'week',
          label: `Tuần này (${formatViDate(start)} - ${formatViDate(end)})`,
          startDate: start,
          endDate: end,
        };
      } else if (selectedWeekType === 'last_week') {
        const d = new Date(today + 'T00:00:00');
        d.setDate(d.getDate() - 7);
        const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const { start, end } = getWeekRange(ymd);
        return {
          type: 'week',
          label: `Tuần trước (${formatViDate(start)} - ${formatViDate(end)})`,
          startDate: start,
          endDate: end,
        };
      } else {
        const { start, end } = getWeekRange(pickedWeekDate || today);
        return {
          type: 'week',
          label: `Tuần (${formatViDate(start)} - ${formatViDate(end)})`,
          startDate: start,
          endDate: end,
        };
      }
    }

    if (periodType === 'month') {
      const parts = selectedMonth.split('-');
      const y = parseInt(parts[0]);
      const m = parseInt(parts[1]);
      const lastDay = new Date(y, m, 0).getDate();
      const start = `${selectedMonth}-01`;
      const end = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
      return {
        type: 'month',
        label: `Tháng ${m}/${y} (${formatViDate(start)} - ${formatViDate(end)})`,
        startDate: start,
        endDate: end,
      };
    }

    if (periodType === 'semester') {
      if (selectedSemester === 'hk1') {
        const start = `${startYear}-09-01`;
        const end = `${startYear + 1}-01-15`;
        return {
          type: 'semester',
          label: `Học kỳ 1 Năm học ${schoolYear} (${formatViDate(start)} - ${formatViDate(end)})`,
          startDate: start,
          endDate: end,
        };
      } else {
        const start = `${endYear}-01-16`;
        const end = `${endYear}-05-31`;
        return {
          type: 'semester',
          label: `Học kỳ 2 Năm học ${schoolYear} (${formatViDate(start)} - ${formatViDate(end)})`,
          startDate: start,
          endDate: end,
        };
      }
    }

    if (periodType === 'year') {
      const start = `${startYear}-09-01`;
      const end = `${endYear}-05-31`;
      return {
        type: 'year',
        label: `Cả năm học ${schoolYear} (${formatViDate(start)} - ${formatViDate(end)})`,
        startDate: start,
        endDate: end,
      };
    }

    // Custom
    const s = customStartDate || today;
    const e = customEndDate || today;
    return {
      type: 'custom',
      label: `Khoảng ngày tùy chọn (${formatViDate(s)} - ${formatViDate(e)})`,
      startDate: s <= e ? s : e,
      endDate: s <= e ? e : s,
    };
  }, [
    periodType,
    selectedWeekType,
    pickedWeekDate,
    selectedMonth,
    selectedSemester,
    customStartDate,
    customEndDate,
    today,
    startYear,
    endYear,
    schoolYear,
  ]);

  // Preview real-time statistics
  const previewData = useMemo(() => {
    if (!isOpen) return { totalRecords: 0, activeStudents: 0 };
    const { summaries, periodRecords } = calculateEmulationData(
      state.students,
      state.discipline || [],
      periodInfo.startDate,
      periodInfo.endDate,
      state.config.className
    );
    const active = summaries.filter((s) => s.positiveCount > 0 || s.negativeCount > 0).length;
    return {
      totalRecords: periodRecords.length,
      activeStudents: active,
    };
  }, [isOpen, state.students, state.discipline, periodInfo, state.config.className]);

  if (!isOpen) return null;

  // Available school months in academic year
  const academicMonths = [
    { label: `Tháng 9/${startYear}`, value: `${startYear}-09` },
    { label: `Tháng 10/${startYear}`, value: `${startYear}-10` },
    { label: `Tháng 11/${startYear}`, value: `${startYear}-11` },
    { label: `Tháng 12/${startYear}`, value: `${startYear}-12` },
    { label: `Tháng 1/${endYear}`, value: `${endYear}-01` },
    { label: `Tháng 2/${endYear}`, value: `${endYear}-02` },
    { label: `Tháng 3/${endYear}`, value: `${endYear}-03` },
    { label: `Tháng 4/${endYear}`, value: `${endYear}-04` },
    { label: `Tháng 5/${endYear}`, value: `${endYear}-05` },
  ];

  const handleExport = async () => {
    if (state.students.length === 0) {
      onShowToast('Lớp học chưa có dữ liệu học sinh để xuất báo cáo.', 'error');
      return;
    }

    setIsExporting(true);
    try {
      const res = await exportEmulationToExcel(state, periodInfo);
      if (res.success) {
        onShowToast(
          `Đã xuất thành công file thi đua ${state.config.className} (${res.totalStudents} học sinh, ${res.totalRecords} sự việc)`,
          'success'
        );
        onClose();
      }
    } catch (err: any) {
      console.error('Export Excel error:', err);
      onShowToast(err.message || 'Lỗi khi tạo file Excel thi đua.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const now = new Date();
  const exportTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ngày ${formatViDate(
    now.toISOString().substring(0, 10)
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#E5B2BD] flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="bg-linear-to-r from-[#FCF4F6] via-[#FAF0F3] to-[#F8E2E7] border-b border-[#E5B2BD] p-5 sm:p-6 text-[#1E293B] relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/80 hover:bg-white text-[#1E293B] border border-[#EDB5C1] transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#EDB5C1] flex items-center justify-center text-[#1E293B] shadow-md border border-[#E5B2BD]">
              <FileSpreadsheet className="w-7 h-7 text-[#1E293B] stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full bg-[#FCF4F6] border border-[#EDB5C1] text-[11px] font-black text-[#1E293B] uppercase tracking-wider">
                  Chỉ Dành Cho Giáo Viên
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#1E293B] text-white text-[11px] font-black">
                  Lớp {state.config.className}
                </span>
              </div>
              <h2 className="text-xl font-black tracking-tight text-[#1E293B] mt-1">
                Xuất Excel Thi Đua Nề Nếp
              </h2>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 bg-[#FCF4F6]/40">
          {/* Metadata Card: Class info, Teacher, Export time */}
          <div className="bg-white rounded-2xl p-4 border border-[#E5B2BD] shadow-2xs space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-gray-700">
              <div className="flex items-center gap-2">
                <School className="w-4 h-4 text-[#1E293B] shrink-0" />
                <span className="font-semibold truncate">
                  {state.config.schoolName || 'Trường THCS Chu Văn An'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#1E293B] shrink-0" />
                <span className="font-semibold">Năm học: {schoolYear}</span>
              </div>
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#1E293B] shrink-0" />
                <span className="font-semibold truncate">
                  GVCN: {state.config.teacherName || 'Cô Lê Thị Kim Thanh'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#1E293B] shrink-0" />
                <span className="font-semibold text-gray-600">
                  Thời gian xuất: <strong className="text-gray-900">{exportTimeStr}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Chọn Kỳ Báo Cáo */}
          <div>
            <label className="block text-xs font-black text-gray-800 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span>1. Chọn Kỳ Báo Cáo Thi Đua</span>
              <span className="text-[11px] font-black text-[#1E293B]">Đầy đủ 5 tùy chọn</span>
            </label>

            {/* Tabs chọn loại kỳ */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 p-1 bg-gray-100 rounded-2xl border border-gray-200 text-xs font-bold text-gray-700">
              <button
                type="button"
                onClick={() => setPeriodType('week')}
                className={`py-2 px-1.5 rounded-xl transition-all cursor-pointer text-center ${
                  periodType === 'week'
                    ? 'bg-[#EDB5C1] text-[#1E293B] shadow-xs font-black'
                    : 'hover:text-gray-900'
                }`}
              >
                Theo Tuần
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('month')}
                className={`py-2 px-1.5 rounded-xl transition-all cursor-pointer text-center ${
                  periodType === 'month'
                    ? 'bg-[#EDB5C1] text-[#1E293B] shadow-xs font-black'
                    : 'hover:text-gray-900'
                }`}
              >
                Theo Tháng
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('semester')}
                className={`py-2 px-1.5 rounded-xl transition-all cursor-pointer text-center ${
                  periodType === 'semester'
                    ? 'bg-[#EDB5C1] text-[#1E293B] shadow-xs font-black'
                    : 'hover:text-gray-900'
                }`}
              >
                Học Kỳ
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('year')}
                className={`py-2 px-1.5 rounded-xl transition-all cursor-pointer text-center ${
                  periodType === 'year'
                    ? 'bg-[#EDB5C1] text-[#1E293B] shadow-xs font-black'
                    : 'hover:text-gray-900'
                }`}
              >
                Cả Năm
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('custom')}
                className={`py-2 px-1.5 rounded-xl transition-all cursor-pointer text-center col-span-2 sm:col-span-1 ${
                  periodType === 'custom'
                    ? 'bg-[#EDB5C1] text-[#1E293B] shadow-xs font-black'
                    : 'hover:text-gray-900'
                }`}
              >
                Tùy Chọn
              </button>
            </div>

            {/* Chi tiết cho từng loại kỳ */}
            <div className="mt-3 p-4 bg-white rounded-2xl border border-[#E5B2BD] shadow-2xs">
              {/* 1. Theo Tuần */}
              {periodType === 'week' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedWeekType('this_week')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        selectedWeekType === 'this_week'
                          ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-2xs'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Tuần này
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedWeekType('last_week')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        selectedWeekType === 'last_week'
                          ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-2xs'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Tuần trước
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedWeekType('pick_date')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        selectedWeekType === 'pick_date'
                          ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-2xs'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Chọn một ngày trong tuần
                    </button>
                  </div>

                  {selectedWeekType === 'pick_date' && (
                    <div className="pt-2">
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        Chọn ngày để tự động tính trọn tuần (Thứ 2 đến Chủ nhật):
                      </label>
                      <input
                        type="date"
                        value={pickedWeekDate}
                        onChange={(e) => setPickedWeekDate(e.target.value)}
                        className="w-full sm:w-auto px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* 2. Theo Tháng */}
              {periodType === 'month' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-700">
                    Chọn tháng báo cáo thi đua:
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500 cursor-pointer"
                  >
                    {academicMonths.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 3. Học Kỳ */}
              {periodType === 'semester' && (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedSemester('hk1')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      selectedSemester === 'hk1'
                        ? 'bg-rose-50 border-rose-500 shadow-xs'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-black text-xs sm:text-sm text-gray-900">Học Kỳ 1</div>
                    <div className="text-[11px] text-gray-500 mt-1">
                      01/09/{startYear} - 15/01/{endYear}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSemester('hk2')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      selectedSemester === 'hk2'
                        ? 'bg-rose-50 border-rose-500 shadow-xs'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-black text-xs sm:text-sm text-gray-900">Học Kỳ 2</div>
                    <div className="text-[11px] text-gray-500 mt-1">
                      16/01/{endYear} - 31/05/{endYear}
                    </div>
                  </button>
                </div>
              )}

              {/* 4. Cả Năm */}
              {periodType === 'year' && (
                <div className="p-2 text-xs text-gray-700 font-medium">
                  Báo cáo toàn bộ sự việc thi đua trong cả năm học{' '}
                  <strong className="text-gray-900">{schoolYear}</strong> (từ 01/09/{startYear} đến{' '}
                  31/05/{endYear}).
                </div>
              )}

              {/* 5. Tùy Chọn Khoảng Ngày */}
              {periodType === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Từ ngày (bao gồm cả ngày):
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Đến ngày (bao gồm cả ngày):
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Phạm vi & Dự kiến kết quả xuất */}
          <div className="bg-linear-to-r from-emerald-50 via-teal-50 to-emerald-50 rounded-2xl p-4 border border-emerald-200 space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Dự Kiến Dữ Liệu Sẽ Xuất Vào File:</span>
            </div>
            <div className="text-xs text-emerald-800 font-medium space-y-1">
              <div>
                • Khoảng thời gian:{' '}
                <strong className="text-emerald-950 font-bold">{periodInfo.label}</strong>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                <span>
                  • Toàn bộ học sinh lớp:{' '}
                  <strong className="text-emerald-950">{state.students.length} em</strong> (kể cả chưa có ghi nhận)
                </span>
                <span>
                  • Lượt sự việc trong kỳ:{' '}
                  <strong className="text-emerald-950">{previewData.totalRecords} lượt</strong>
                </span>
                <span>
                  • Học sinh có ghi nhận:{' '}
                  <strong className="text-emerald-950">{previewData.activeStudents} em</strong>
                </span>
              </div>
              <div className="text-[11px] text-emerald-700 italic pt-1">
                * Xuất 2 sheet đầy đủ: Sheet “Tổng hợp thi đua” và Sheet “Chi tiết ghi nhận”, cố định dòng tiêu đề và bật sẵn bộ lọc Excel.
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-gray-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || state.students.length === 0}
            className="px-5 py-2.5 rounded-xl bg-[#EDB5C1] hover:bg-[#E4A7B4] text-[#1E293B] font-black text-xs sm:text-sm shadow-md shadow-[#EDB5C1]/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Đang tạo file Excel...' : 'Tải File Excel Thi Đua (.xlsx)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

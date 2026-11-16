import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Save, AlertCircle, Award, Calendar, Loader2, RotateCcw } from 'lucide-react';
import {
  AppState,
  ConductTierConfig,
  EmulationConfig,
  SchoolYearSemesterConfig,
} from '../types';
import {
  getEmulationConfigForClass,
  validateConductTiers,
} from '../utils/emulationEvaluation';
import {
  getAllAvailableSchoolYears,
  getDefaultSemesterConfig,
  getSemesterConfigForYear,
  getSemesterInitialPoints,
  normalizeSchoolYear,
  validateSemesterConfig,
} from '../utils/semesterUtils';
import { formatViDate } from '../utils/helpers';

interface EmulationScaleSettingsProps {
  state: AppState;
  onUpdateEmulationConfig: (
    newConfig: EmulationConfig
  ) => Promise<{ success: boolean; error?: string }> | void;
  onUpdateSemesterConfig?: (
    cfg: SchoolYearSemesterConfig
  ) => Promise<{ success: boolean; error?: string }> | void;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

/**
 * Biểu mẫu cấu hình Thang điểm thi đua & Tiêu chí xếp loại:
 * - Dùng một khung duy nhất theo mẫu màu xanh, đơn giản, gọn, dễ nhập
 * - Ô "Điểm thi đua chuẩn ban đầu"
 * - 3 thẻ nằm ngang: TỐT, KHÁ, ĐẠT
 * - Chú thích: "Điểm dưới ngưỡng Đạt được xếp loại gợi ý Chưa đạt"
 * - Nút "Lưu thang điểm & tiêu chí" nổi bật
 * - State chuỗi độc lập, cho phép bôi đen, xóa hết, gõ lại, dán số
 * - Không kiểm tra Tốt > Khá > Đạt trong từng lần gõ (chỉ kiểm tra khi nhấn Lưu)
 * - Không ghi đè bản nháp khi đồng bộ Supabase
 */
export const EmulationScaleSettings: React.FC<EmulationScaleSettingsProps> = ({
  state,
  onUpdateEmulationConfig,
  onUpdateSemesterConfig,
  onShowToast,
}) => {
  const currentClass = state.config.className || '6A8';
  const currentYear = state.config.schoolYear || '2026 - 2027';
  const classKey = `${currentClass}_${currentYear}`;

  // Lấy cấu hình thi đua hiện hành cho đúng lớp và năm học
  const activeClassConfig = getEmulationConfigForClass(
    state.classEmulationConfigs,
    state.emulationConfig,
    currentClass,
    currentYear
  );

  // Helper trích xuất giá trị lưu từ config (mặc định 200 điểm cho mỗi học kỳ)
  const getStoredValues = (cfg: EmulationConfig) => {
    const totTier = cfg.conductTiers?.find((t) => t.id === 'tot');
    const khaTier = cfg.conductTiers?.find((t) => t.id === 'kha');
    const datTier = cfg.conductTiers?.find((t) => t.id === 'dat');

    const initPts = getSemesterInitialPoints(cfg);
    const tVal = totTier?.minScore !== undefined ? totTier.minScore : 105;
    const kVal = khaTier?.minScore !== undefined ? khaTier.minScore : 90;
    const dVal = datTier?.minScore !== undefined ? datTier.minScore : 70;

    return {
      initPts: String(initPts),
      tVal: String(tVal),
      kVal: String(kVal),
      dVal: String(dVal),
    };
  };

  // State biểu mẫu riêng biệt dạng chuỗi - khởi tạo từ cấu hình hiện tại
  const initialVals = getStoredValues(activeClassConfig);
  const [initialPointsInput, setInitialPointsInput] = useState<string>(initialVals.initPts);
  const [totInput, setTotInput] = useState<string>(initialVals.tVal);
  const [khaInput, setKhaInput] = useState<string>(initialVals.kVal);
  const [datInput, setDatInput] = useState<string>(initialVals.dVal);

  // Theo dõi xem giáo viên có đang sửa bản nháp không và đã nạp remote lần đầu chưa
  const isDirtyRef = useRef(false);
  const currentClassKeyRef = useRef(classKey);
  const hasInitializedFromRemoteRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  // Lỗi hiển thị tại từng ô và lỗi tổng quát
  const [fieldErrors, setFieldErrors] = useState<{
    initialPoints?: string;
    tot?: string;
    kha?: string;
    dat?: string;
  }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  /**
   * Chỉ nạp lại biểu mẫu khi:
   * 1. Đổi lớp / năm học (luôn nạp lại cấu hình của lớp mới)
   * 2. Hoặc lần đầu tiên tải cấu hình từ máy chủ và giáo viên CHƯA chỉnh sửa (!isDirtyRef.current)
   * Tuyệt đối KHÔNG ghi đè bản nháp đang chỉnh bởi dữ liệu đồng bộ
   */
  useEffect(() => {
    // Trường hợp 1: Giáo viên chuyển lớp hoặc năm học
    if (currentClassKeyRef.current !== classKey) {
      currentClassKeyRef.current = classKey;
      isDirtyRef.current = false;
      hasInitializedFromRemoteRef.current = false;
      const vals = getStoredValues(activeClassConfig);
      setInitialPointsInput(vals.initPts);
      setTotInput(vals.tVal);
      setKhaInput(vals.kVal);
      setDatInput(vals.dVal);
      setFieldErrors({});
      setGeneralError(null);
      return;
    }

    // Trường hợp 2: Lần đầu tiên dữ liệu tải về từ Supabase và giáo viên CHƯA chạm vào biểu mẫu
    if (!hasInitializedFromRemoteRef.current && !isDirtyRef.current) {
      hasInitializedFromRemoteRef.current = true;
      const vals = getStoredValues(activeClassConfig);
      setInitialPointsInput(vals.initPts);
      setTotInput(vals.tVal);
      setKhaInput(vals.kVal);
      setDatInput(vals.dVal);
    }
    // Khi đã khởi tạo hoặc giáo viên đang sửa (isDirtyRef.current === true), giữ nguyên 100% nội dung
  }, [classKey, activeClassConfig]);

  // Handler nhập liệu tự do: không ép số, không phục hồi mặc định, cho phép bôi đen xóa hết
  const handleInitialPointsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isDirtyRef.current = true;
    setInitialPointsInput(e.target.value);
    setFieldErrors((prev) => ({ ...prev, initialPoints: undefined }));
    setGeneralError(null);
  };

  const handleTotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isDirtyRef.current = true;
    setTotInput(e.target.value);
    setFieldErrors((prev) => ({ ...prev, tot: undefined }));
    setGeneralError(null);
  };

  const handleKhaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isDirtyRef.current = true;
    setKhaInput(e.target.value);
    setFieldErrors((prev) => ({ ...prev, kha: undefined }));
    setGeneralError(null);
  };

  const handleDatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isDirtyRef.current = true;
    setDatInput(e.target.value);
    setFieldErrors((prev) => ({ ...prev, dat: undefined }));
    setGeneralError(null);
  };

  // Phân tích số hữu hạn linh hoạt (hỗ trợ cả dấu chấm . và phẩy ,)
  const parseVal = (val: string): number | null => {
    if (typeof val !== 'string') return null;
    const trimmed = val.trim().replace(',', '.');
    if (trimmed === '') return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  };

  // Xử lý khi nhấn "Lưu thang điểm & tiêu chí"
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const initPts = parseVal(initialPointsInput);
    const totScore = parseVal(totInput);
    const khaScore = parseVal(khaInput);
    const datScore = parseVal(datInput);

    const errors: {
      initialPoints?: string;
      tot?: string;
      kha?: string;
      dat?: string;
    } = {};

    if (initPts === null) {
      errors.initialPoints = 'Vui lòng nhập điểm ban đầu hợp lệ (số nguyên hoặc số thập phân).';
    }
    if (totScore === null) {
      errors.tot = 'Vui lòng nhập điểm ngưỡng Tốt.';
    }
    if (khaScore === null) {
      errors.kha = 'Vui lòng nhập điểm ngưỡng Khá.';
    }
    if (datScore === null) {
      errors.dat = 'Vui lòng nhập điểm ngưỡng Đạt.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setGeneralError('Vui lòng kiểm tra lại các ô nhập điểm chưa đúng định dạng số.');
      onShowToast('Vui lòng kiểm tra lại các ô nhập điểm', 'error');
      return;
    }

    // Kiểm tra điều kiện giữa các ngưỡng: Tốt > Khá > Đạt
    const draftTiers: ConductTierConfig[] = [
      { id: 'tot', label: 'Tốt', minScore: totScore!, description: 'Đạt ngưỡng xếp loại Tốt' },
      { id: 'kha', label: 'Khá', minScore: khaScore!, description: 'Đạt ngưỡng xếp loại Khá' },
      { id: 'dat', label: 'Đạt', minScore: datScore!, description: 'Đạt ngưỡng xếp loại Đạt' },
      { id: 'chuadat', label: 'Chưa đạt', minScore: datScore!, description: 'Điểm dưới ngưỡng Đạt' },
    ];

    const validation = validateConductTiers(draftTiers, initPts!);
    if (!validation.isValid) {
      if (validation.fieldErrors) {
        setFieldErrors(validation.fieldErrors);
      }
      setGeneralError(validation.errorMessage || 'Điều kiện giữa các ngưỡng phải là: Tốt > Khá > Đạt.');
      onShowToast(validation.errorMessage || 'Thang điểm chưa hợp lệ', 'error');
      return;
    }

    setIsSaving(true);
    setGeneralError(null);

    const newVersion = (activeClassConfig.version || 1) + 1;
    const updatedConfig: EmulationConfig = {
      ...activeClassConfig,
      initialPoints: initPts!,
      periodType: activeClassConfig.periodType || 'month',
      enableMinScore: false,
      enableMaxScore: false,
      aggregationMethod: 'single_initial',
      conductTiers: draftTiers,
      version: newVersion,
      updatedAt: new Date().toISOString(),
      appliedAt: activeClassConfig.appliedAt || '2024-09-01',
    };

    try {
      const res = await onUpdateEmulationConfig(updatedConfig);
      setIsSaving(false);

      if (res && res.success === false) {
        setGeneralError(res.error || 'Lỗi khi lưu dữ liệu lên máy chủ.');
        onShowToast(res.error || 'Lỗi khi lưu cấu hình', 'error');
        return;
      }

      // Lưu thành công thực sự: đánh dấu hết dirty và giữ trạng thái đã nạp
      isDirtyRef.current = false;
      hasInitializedFromRemoteRef.current = true;
      setFieldErrors({});
      setGeneralError(null);
      onShowToast(`Đã lưu thang điểm & tiêu chí lớp ${currentClass} thành công!`);
    } catch (err: any) {
      setIsSaving(false);
      setGeneralError(err?.message || 'Lỗi hệ thống khi lưu.');
      onShowToast(err?.message || 'Lỗi khi lưu cấu hình', 'error');
    }
  };

  // ================================================================
  // CẤU HÌNH THỜI GIAN HỌC KỲ I & HỌC KỲ II THEO TỪNG NĂM HỌC
  // ================================================================
  const availableSchoolYears = useMemo(
    () => getAllAvailableSchoolYears(state),
    [state]
  );
  const [selectedScheduleYear, setSelectedScheduleYear] = useState<string>(
    normalizeSchoolYear(currentYear)
  );
  const [customYearInput, setCustomYearInput] = useState<string>('');

  const storedSemesterCfg = useMemo(
    () => getSemesterConfigForYear(state.semesterConfigs, selectedScheduleYear),
    [state.semesterConfigs, selectedScheduleYear]
  );

  const [hk1Start, setHk1Start] = useState<string>(storedSemesterCfg.hk1Start);
  const [hk1End, setHk1End] = useState<string>(storedSemesterCfg.hk1End);
  const [hk2Start, setHk2Start] = useState<string>(storedSemesterCfg.hk2Start);
  const [hk2End, setHk2End] = useState<string>(storedSemesterCfg.hk2End);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  const isScheduleDirtyRef = useRef(false);
  const scheduleYearRef = useRef(selectedScheduleYear);

  useEffect(() => {
    if (scheduleYearRef.current !== selectedScheduleYear) {
      scheduleYearRef.current = selectedScheduleYear;
      isScheduleDirtyRef.current = false;
      setHk1Start(storedSemesterCfg.hk1Start);
      setHk1End(storedSemesterCfg.hk1End);
      setHk2Start(storedSemesterCfg.hk2Start);
      setHk2End(storedSemesterCfg.hk2End);
      setScheduleError(null);
      return;
    }
    if (!isScheduleDirtyRef.current) {
      setHk1Start(storedSemesterCfg.hk1Start);
      setHk1End(storedSemesterCfg.hk1End);
      setHk2Start(storedSemesterCfg.hk2Start);
      setHk2End(storedSemesterCfg.hk2End);
    }
  }, [selectedScheduleYear, storedSemesterCfg]);

  const handleSaveSemesterSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateSemesterConfig) return;

    const draft: SchoolYearSemesterConfig = {
      schoolYear: normalizeSchoolYear(selectedScheduleYear),
      hk1Start,
      hk1End,
      hk2Start,
      hk2End,
    };

    const validation = validateSemesterConfig(draft);
    if (!validation.isValid) {
      setScheduleError(validation.errorMessage || 'Thời gian học kỳ chưa hợp lệ.');
      onShowToast(validation.errorMessage || 'Thời gian học kỳ chưa hợp lệ', 'error');
      return;
    }

    setIsSavingSchedule(true);
    setScheduleError(null);
    try {
      const res = await onUpdateSemesterConfig(draft);
      setIsSavingSchedule(false);
      if (res && res.success === false) {
        setScheduleError(res.error || 'Lỗi khi lưu lịch học kỳ.');
        onShowToast(res.error || 'Lỗi khi lưu lịch học kỳ', 'error');
        return;
      }
      isScheduleDirtyRef.current = false;
      onShowToast(`Đã lưu lịch Học kỳ I & II cho năm học ${draft.schoolYear}!`);
    } catch (err: any) {
      setIsSavingSchedule(false);
      setScheduleError(err?.message || 'Lỗi khi lưu lịch học kỳ.');
      onShowToast(err?.message || 'Lỗi khi lưu lịch học kỳ', 'error');
    }
  };

  const handleResetDefaultSchedule = () => {
    const def = getDefaultSemesterConfig(selectedScheduleYear);
    isScheduleDirtyRef.current = true;
    setHk1Start(def.hk1Start);
    setHk1End(def.hk1End);
    setHk2Start(def.hk2Start);
    setHk2End(def.hk2End);
    setScheduleError(null);
  };

  const handleAddCustomScheduleYear = () => {
    const normalized = normalizeSchoolYear(customYearInput);
    if (!/^\d{4}\s*-\s*\d{4}$/.test(normalized)) {
      onShowToast('Vui lòng nhập năm học đúng định dạng (ví dụ: 2027 - 2028)', 'error');
      return;
    }
    setSelectedScheduleYear(normalized);
    setCustomYearInput('');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
    <div className="bg-white rounded-3xl p-5 sm:p-7 border border-blue-200/90 shadow-xs space-y-6">
      {/* 1. Tiêu đề Khung Duy Nhất */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-blue-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
            <Award className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
              Thang điểm thi đua & Tiêu chí xếp loại
            </h3>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-blue-700 font-semibold">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                Lớp {currentClass}
              </span>
              <span>•</span>
              <span className="text-gray-500">Năm học: {currentYear}</span>
              {activeClassConfig.version && (
                <>
                  <span>•</span>
                  <span className="text-gray-400">Phiên bản v{activeClassConfig.version}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 2. Phía trên: Ô “Điểm thi đua chuẩn ban đầu” */}
        <div className="bg-blue-50/70 rounded-2xl p-4 sm:p-5 border border-blue-200/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label
                htmlFor="initial-points-input"
                className="block text-sm font-black text-blue-950 uppercase tracking-wide cursor-pointer"
              >
                Điểm thi đua chuẩn ban đầu
              </label>
              <p className="text-xs text-blue-800/80 mt-0.5 font-medium">
                Mỗi học kỳ khởi tạo độc lập với số điểm này (mặc định 200 điểm/học kỳ, không cộng dồn giữa HK I và HK II)
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <input
                id="initial-points-input"
                name="initialPoints"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={initialPointsInput}
                onChange={handleInitialPointsChange}
                placeholder="200"
                className={`w-36 px-4 py-2.5 bg-white border-2 rounded-xl text-base font-black text-gray-900 text-center shadow-2xs focus:outline-hidden focus:ring-2 transition-all ${
                  fieldErrors.initialPoints
                    ? 'border-rose-400 focus:ring-rose-300'
                    : 'border-blue-300 focus:border-blue-600 focus:ring-blue-200'
                }`}
              />
              <span className="text-sm font-bold text-blue-900">điểm</span>
            </div>
          </div>
          {fieldErrors.initialPoints && (
            <p className="text-xs text-rose-600 font-bold mt-2 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{fieldErrors.initialPoints}</span>
            </p>
          )}
        </div>

        {/* 3. Phía dưới: 3 thẻ nằm ngang (TỐT, KHÁ, ĐẠT) - Trên điện thoại tự xuống dòng */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {/* THẺ TỐT */}
          <div className="bg-sky-50/80 border border-sky-200/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-2xs hover:border-sky-300 transition-all">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-sky-200/60">
                <span className="text-base font-black text-sky-900 tracking-wide">TỐT</span>
                <span className="text-[11px] font-bold text-sky-700 bg-sky-200/70 px-2 py-0.5 rounded-md">
                  ≥ Ngưỡng T
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-sky-950 shrink-0">Từ</span>
                <input
                  id="tot-score-input"
                  name="totScore"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={totInput}
                  onChange={handleTotChange}
                  placeholder="105"
                  className={`w-full px-3 py-2.5 bg-white border-2 rounded-xl text-base font-black text-gray-900 text-center shadow-2xs focus:outline-hidden focus:ring-2 transition-all ${
                    fieldErrors.tot
                      ? 'border-rose-400 focus:ring-rose-300'
                      : 'border-sky-300 focus:border-sky-600 focus:ring-sky-200'
                  }`}
                />
                <span className="text-sm font-bold text-sky-950 shrink-0">điểm</span>
              </div>
            </div>
            {fieldErrors.tot ? (
              <p className="text-xs text-rose-600 font-bold mt-2.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fieldErrors.tot}</span>
              </p>
            ) : (
              <p className="text-[11px] text-sky-700/80 mt-2.5 font-medium">
                Điểm thi đua từ {totInput || '...'} trở lên
              </p>
            )}
          </div>

          {/* THẺ KHÁ */}
          <div className="bg-blue-50/80 border border-blue-200/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-2xs hover:border-blue-300 transition-all">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-200/60">
                <span className="text-base font-black text-blue-900 tracking-wide">KHÁ</span>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-200/70 px-2 py-0.5 rounded-md">
                  K ≤ Điểm &lt; T
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-blue-950 shrink-0">Từ</span>
                <input
                  id="kha-score-input"
                  name="khaScore"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={khaInput}
                  onChange={handleKhaChange}
                  placeholder="90"
                  className={`w-full px-3 py-2.5 bg-white border-2 rounded-xl text-base font-black text-gray-900 text-center shadow-2xs focus:outline-hidden focus:ring-2 transition-all ${
                    fieldErrors.kha
                      ? 'border-rose-400 focus:ring-rose-300'
                      : 'border-blue-300 focus:border-blue-600 focus:ring-blue-200'
                  }`}
                />
                <span className="text-sm font-bold text-blue-950 shrink-0">điểm</span>
              </div>
            </div>
            {fieldErrors.kha ? (
              <p className="text-xs text-rose-600 font-bold mt-2.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fieldErrors.kha}</span>
              </p>
            ) : (
              <p className="text-[11px] text-blue-700/80 mt-2.5 font-medium">
                Từ {khaInput || '...'} đến dưới {totInput || '...'} điểm
              </p>
            )}
          </div>

          {/* THẺ ĐẠT */}
          <div className="bg-teal-50/80 border border-teal-200/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-2xs hover:border-teal-300 transition-all">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-teal-200/60">
                <span className="text-base font-black text-teal-900 tracking-wide">ĐẠT</span>
                <span className="text-[11px] font-bold text-teal-700 bg-teal-200/70 px-2 py-0.5 rounded-md">
                  D ≤ Điểm &lt; K
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-teal-950 shrink-0">Từ</span>
                <input
                  id="dat-score-input"
                  name="datScore"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={datInput}
                  onChange={handleDatChange}
                  placeholder="70"
                  className={`w-full px-3 py-2.5 bg-white border-2 rounded-xl text-base font-black text-gray-900 text-center shadow-2xs focus:outline-hidden focus:ring-2 transition-all ${
                    fieldErrors.dat
                      ? 'border-rose-400 focus:ring-rose-300'
                      : 'border-teal-300 focus:border-teal-600 focus:ring-teal-200'
                  }`}
                />
                <span className="text-sm font-bold text-teal-950 shrink-0">điểm</span>
              </div>
            </div>
            {fieldErrors.dat ? (
              <p className="text-xs text-rose-600 font-bold mt-2.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fieldErrors.dat}</span>
              </p>
            ) : (
              <p className="text-[11px] text-teal-700/80 mt-2.5 font-medium">
                Từ {datInput || '...'} đến dưới {khaInput || '...'} điểm
              </p>
            )}
          </div>
        </div>

        {/* 4. Dòng chú thích */}
        <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200/70 text-xs text-gray-700 space-y-1.5">
          <div className="font-black text-blue-900 flex items-center gap-2 text-xs sm:text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
            <span>Điểm dưới ngưỡng Đạt được xếp loại gợi ý Chưa đạt.</span>
          </div>
          <div className="text-[11px] text-gray-600 pl-4 space-y-0.5 font-medium">
            <p>
              • <strong>Cách tính:</strong> Điểm thi đua = Điểm ban đầu + Tổng điểm thưởng − Tổng điểm vi phạm.
            </p>
            <p>
              • <strong>Nguyên tắc xếp loại:</strong> Điểm ≥ Tốt: Tốt; Khá ≤ Điểm &lt; Tốt: Khá; Đạt ≤ Điểm &lt; Khá: Đạt; Điểm &lt; Đạt: Chưa đạt.
            </p>
            <p className="text-gray-500 italic">
              • Đây là xếp loại gợi ý theo điểm thi đua; giáo viên luôn giữ quyền xác nhận kết quả rèn luyện chính thức cho từng học sinh.
            </p>
          </div>
        </div>

        {/* Thông báo lỗi tổng quát nếu có */}
        {generalError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        {/* 5. Nút “Lưu thang điểm & tiêu chí” luôn dễ nhìn thấy */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100">
          <div className="text-xs text-gray-500 font-medium">
            Điều kiện hợp lệ: <strong className="text-gray-800">Tốt &gt; Khá &gt; Đạt</strong> (chấp nhận số hữu hạn, 0, số âm, số thập phân).
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-linear-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm shadow-md shadow-blue-500/25 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 disabled:opacity-60"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 stroke-[2.5]" />
                <span>Lưu thang điểm &amp; tiêu chí</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>

    {/* KHUNG 2: CẤU HÌNH THỜI GIAN HỌC KỲ I & II THEO TỪNG NĂM HỌC */}
    {onUpdateSemesterConfig && (
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-[#E5B2BD] shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#EDB5C1]/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EDB5C1] text-[#1E293B] flex items-center justify-center shadow-sm shrink-0">
              <Calendar className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                Cấu hình Thời gian Học kỳ I &amp; Học kỳ II theo Năm học
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Hệ thống tự động chuyển học kỳ và khởi tạo 200/200 điểm cho Học kỳ II dựa trên mốc ngày cấu hình bên dưới.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetDefaultSchedule}
            className="px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-700 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            title="Khôi phục ngày mặc định cho năm học đang chọn"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Mặc định năm này</span>
          </button>
        </div>

        <form onSubmit={handleSaveSemesterSchedule} className="space-y-5">
          {/* Chọn hoặc thêm năm học */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end bg-[#FCF4F6]/70 p-4 rounded-2xl border border-[#EDB5C1]/60">
            <div>
              <label className="block text-xs font-black text-[#1E293B] uppercase mb-1.5">
                Chọn năm học cần cấu hình
              </label>
              <select
                value={selectedScheduleYear}
                onChange={(e) => setSelectedScheduleYear(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-[#EDB5C1] rounded-xl text-sm font-bold text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] cursor-pointer"
              >
                {Array.from(new Set([...availableSchoolYears, selectedScheduleYear]))
                  .sort((a, b) => a.localeCompare(b))
                  .map((yr) => (
                    <option key={yr} value={yr}>
                      Năm học {yr}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">
                Hoặc thêm năm học khác (VD: 2027 - 2028)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customYearInput}
                  onChange={(e) => setCustomYearInput(e.target.value)}
                  placeholder="2027 - 2028"
                  className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]"
                />
                <button
                  type="button"
                  onClick={handleAddCustomScheduleYear}
                  className="px-3.5 py-2 rounded-xl bg-white border border-[#EDB5C1] hover:bg-[#EDB5C1]/30 text-xs font-black text-[#1E293B] cursor-pointer shrink-0"
                >
                  Chọn năm
                </button>
              </div>
            </div>
          </div>

          {/* 2 Khối Học kỳ I & Học kỳ II */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Học kỳ I */}
            <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-3">
              <div className="flex items-center justify-between border-b border-sky-200/70 pb-2">
                <span className="text-sm font-black text-sky-950">HỌC KỲ I</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800">
                  Khởi tạo: 200đ
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-sky-900 mb-1">
                    Ngày bắt đầu HK I
                  </label>
                  <input
                    type="date"
                    required
                    value={hk1Start}
                    onChange={(e) => {
                      isScheduleDirtyRef.current = true;
                      setHk1Start(e.target.value);
                      setScheduleError(null);
                    }}
                    className="w-full px-3 py-2 bg-white border border-sky-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-sky-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-sky-900 mb-1">
                    Ngày kết thúc HK I
                  </label>
                  <input
                    type="date"
                    required
                    value={hk1End}
                    onChange={(e) => {
                      isScheduleDirtyRef.current = true;
                      setHk1End(e.target.value);
                      setScheduleError(null);
                    }}
                    className="w-full px-3 py-2 bg-white border border-sky-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-sky-300"
                  />
                </div>
              </div>
              <p className="text-[11px] text-sky-800/80 font-medium">
                Phạm vi: {formatViDate(hk1Start)} → {formatViDate(hk1End)}
              </p>
            </div>

            {/* Học kỳ II */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-200/70 pb-2">
                <span className="text-sm font-black text-emerald-950">HỌC KỲ II</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  Khởi tạo mới: 200đ
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                    Ngày bắt đầu HK II
                  </label>
                  <input
                    type="date"
                    required
                    value={hk2Start}
                    onChange={(e) => {
                      isScheduleDirtyRef.current = true;
                      setHk2Start(e.target.value);
                      setScheduleError(null);
                    }}
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                    Ngày kết thúc HK II
                  </label>
                  <input
                    type="date"
                    required
                    value={hk2End}
                    onChange={(e) => {
                      isScheduleDirtyRef.current = true;
                      setHk2End(e.target.value);
                      setScheduleError(null);
                    }}
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
              </div>
              <p className="text-[11px] text-emerald-800/80 font-medium">
                Phạm vi: {formatViDate(hk2Start)} → {formatViDate(hk2End)}
              </p>
            </div>
          </div>

          {scheduleError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{scheduleError}</span>
            </div>
          )}

          <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-[11px] text-gray-500">
              Lịch sử vi phạm/khen thưởng cũ luôn được giữ nguyên theo từng học kỳ và không bao giờ bị xóa khi chuyển kỳ.
            </p>
            <button
              type="submit"
              disabled={isSavingSchedule}
              className="px-5 py-2.5 rounded-2xl bg-[#EDB5C1] hover:bg-[#E4A7B4] text-[#1E293B] font-black text-xs sm:text-sm shadow-sm active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 disabled:opacity-60"
            >
              {isSavingSchedule ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Lưu thời gian học kỳ</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    )}
    </div>
  );
};

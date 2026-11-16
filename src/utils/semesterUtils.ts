import {
  AppState,
  ConductGrade,
  DisciplineRecord,
  EmulationConfig,
  OfficialConductEvaluation,
  SchoolYearSemesterConfig,
  SemesterId,
  Student,
} from '../types';
import {
  DEFAULT_EMULATION_CONFIG,
  evaluateStudentEmulation,
  StudentEvaluationResult,
} from './emulationEvaluation';

export const SEMESTER_BASE_POINTS = 200;

/**
 * Chuẩn hóa chuỗi năm học về dạng "YYYY - YYYY" (ví dụ: "2026-2027" -> "2026 - 2027")
 */
export function normalizeSchoolYear(schoolYear?: string): string {
  const raw = (schoolYear || '').trim();
  const match = raw.match(/(\d{4})\s*[-–]\s*(\d{4})/);
  if (match) {
    return `${match[1]} - ${match[2]}`;
  }
  if (/^\d{4}$/.test(raw)) {
    const y = parseInt(raw, 10);
    return `${y} - ${y + 1}`;
  }
  return raw || inferNaturalSchoolYearFromDate(new Date().toISOString().substring(0, 10));
}

/**
 * Tách năm bắt đầu và năm kết thúc từ chuỗi năm học
 */
export function parseSchoolYearBounds(schoolYear?: string): {
  startYear: number;
  endYear: number;
  normalized: string;
} {
  const normalized = normalizeSchoolYear(schoolYear);
  const match = normalized.match(/(\d{4})\s*[-–]\s*(\d{4})/);
  if (match) {
    return {
      startYear: parseInt(match[1], 10),
      endYear: parseInt(match[2], 10),
      normalized,
    };
  }
  const nowYear = new Date().getFullYear();
  return {
    startYear: nowYear,
    endYear: nowYear + 1,
    normalized: `${nowYear} - ${nowYear + 1}`,
  };
}

/**
 * Suy ra năm học tự nhiên từ 1 ngày YYYY-MM-DD:
 * Tháng 7..12 -> YYYY - (YYYY+1)
 * Tháng 1..6  -> (YYYY-1) - YYYY
 */
export function inferNaturalSchoolYearFromDate(dateStr: string): string {
  const match = (dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    return m >= 7 ? `${y} - ${y + 1}` : `${y - 1} - ${y}`;
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (month >= 7) {
    return `${year} - ${year + 1}`;
  }
  return `${year - 1} - ${year}`;
}

/**
 * Cấu hình ngày mặc định cho Học kỳ I và Học kỳ II của một năm học
 */
export function getDefaultSemesterConfig(schoolYear: string): SchoolYearSemesterConfig {
  const { startYear, endYear, normalized } = parseSchoolYearBounds(schoolYear);
  return {
    schoolYear: normalized,
    hk1Start: `${startYear}-09-01`,
    hk1End: `${endYear}-01-15`,
    hk2Start: `${endYear}-01-16`,
    hk2End: `${endYear}-05-31`,
  };
}

/**
 * Lấy cấu hình thời gian học kỳ của một năm học (nếu chưa cấu hình thì dùng mặc định theo năm học đó)
 */
export function getSemesterConfigForYear(
  semesterConfigs: Record<string, SchoolYearSemesterConfig> | undefined,
  schoolYear: string
): SchoolYearSemesterConfig {
  const normalized = normalizeSchoolYear(schoolYear);
  if (semesterConfigs) {
    if (semesterConfigs[normalized]) {
      return {
        ...getDefaultSemesterConfig(normalized),
        ...semesterConfigs[normalized],
        schoolYear: normalized,
      };
    }
    // Kiểm tra key chưa chuẩn hóa (vd "2026-2027")
    const foundKey = Object.keys(semesterConfigs).find(
      (k) => normalizeSchoolYear(k) === normalized
    );
    if (foundKey && semesterConfigs[foundKey]) {
      return {
        ...getDefaultSemesterConfig(normalized),
        ...semesterConfigs[foundKey],
        schoolYear: normalized,
      };
    }
  }
  return getDefaultSemesterConfig(normalized);
}

/**
 * Kiểm tra chuỗi ngày YYYY-MM-DD có hợp lệ thực tế không
 */
export function isValidIsoDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Kiểm tra tính hợp lệ của lịch học kỳ: hk1Start <= hk1End < hk2Start <= hk2End
 */
export function validateSemesterConfig(cfg: SchoolYearSemesterConfig): {
  isValid: boolean;
  errorMessage?: string;
} {
  if (
    !isValidIsoDate(cfg.hk1Start) ||
    !isValidIsoDate(cfg.hk1End) ||
    !isValidIsoDate(cfg.hk2Start) ||
    !isValidIsoDate(cfg.hk2End)
  ) {
    return {
      isValid: false,
      errorMessage: 'Vui lòng nhập đầy đủ ngày bắt đầu và kết thúc hợp lệ cho cả 2 học kỳ.',
    };
  }
  if (cfg.hk1Start > cfg.hk1End) {
    return {
      isValid: false,
      errorMessage: 'Ngày kết thúc Học kỳ I phải sau hoặc bằng ngày bắt đầu Học kỳ I.',
    };
  }
  if (cfg.hk1End >= cfg.hk2Start) {
    return {
      isValid: false,
      errorMessage: 'Ngày bắt đầu Học kỳ II phải sau ngày kết thúc Học kỳ I (không được trùng hoặc chồng lấn).',
    };
  }
  if (cfg.hk2Start > cfg.hk2End) {
    return {
      isValid: false,
      errorMessage: 'Ngày kết thúc Học kỳ II phải sau hoặc bằng ngày bắt đầu Học kỳ II.',
    };
  }
  return { isValid: true };
}

export interface DetectedDateScope {
  schoolYear: string;
  semester: SemesterId;
  isWithinConfiguredRange: boolean;
  matchedConfig: SchoolYearSemesterConfig;
}

/**
 * Xác định ngày sự việc thuộc Học kỳ nào & Năm học nào dựa trên cấu hình ngày bắt đầu/kết thúc.
 * Trả về isWithinConfiguredRange = false nếu ngày nằm ngoài khoảng thời gian HK I và HK II đã cấu hình.
 */
export function detectSemesterAndYearForDate(
  dateStr: string,
  semesterConfigs: Record<string, SchoolYearSemesterConfig> | undefined,
  preferredSchoolYear?: string
): DetectedDateScope {
  const candidateYears: string[] = [];
  if (preferredSchoolYear) {
    candidateYears.push(normalizeSchoolYear(preferredSchoolYear));
  }
  const naturalYear = inferNaturalSchoolYearFromDate(dateStr);
  if (!candidateYears.includes(naturalYear)) {
    candidateYears.push(naturalYear);
  }
  if (semesterConfigs) {
    for (const k of Object.keys(semesterConfigs)) {
      const norm = normalizeSchoolYear(k);
      if (!candidateYears.includes(norm)) {
        candidateYears.push(norm);
      }
    }
  }

  // 1. Tìm trong các năm học có ngày trùng khớp chính xác khoảng HK I hoặc HK II
  for (const year of candidateYears) {
    const cfg = getSemesterConfigForYear(semesterConfigs, year);
    if (dateStr >= cfg.hk1Start && dateStr <= cfg.hk1End) {
      return {
        schoolYear: cfg.schoolYear,
        semester: 'hk1',
        isWithinConfiguredRange: true,
        matchedConfig: cfg,
      };
    }
    if (dateStr >= cfg.hk2Start && dateStr <= cfg.hk2End) {
      return {
        schoolYear: cfg.schoolYear,
        semester: 'hk2',
        isWithinConfiguredRange: true,
        matchedConfig: cfg,
      };
    }
  }

  // 2. Ngày nằm ngoài cấu hình HK I & HK II
  // Ưu tiên chọn cấu hình của năm học tự nhiên hoặc năm học đang chọn nếu tháng phù hợp
  const targetYear = preferredSchoolYear && candidateYears[0] === naturalYear
    ? normalizeSchoolYear(preferredSchoolYear)
    : naturalYear;
  const fallbackCfg = getSemesterConfigForYear(semesterConfigs, targetYear);

  let fallbackSemester: SemesterId = 'hk1';
  if (dateStr >= fallbackCfg.hk2Start || dateStr > fallbackCfg.hk1End) {
    // Nếu ở giữa hk1End và hk2Start hoặc sau hk2End
    if (dateStr > fallbackCfg.hk1End && dateStr < fallbackCfg.hk2Start) {
      fallbackSemester = 'hk1';
    } else if (dateStr >= fallbackCfg.hk2Start) {
      fallbackSemester = 'hk2';
    }
  } else {
    // Fallback theo tháng cho an toàn nếu năm cấu hình khác năm của dateStr
    const month = parseInt((dateStr || '').substring(5, 7) || '9', 10);
    fallbackSemester = month >= 2 && month <= 6 ? 'hk2' : 'hk1';
  }

  return {
    schoolYear: fallbackCfg.schoolYear,
    semester: fallbackSemester,
    isWithinConfiguredRange: false,
    matchedConfig: fallbackCfg,
  };
}

/**
 * Xác định năm học & học kỳ thực tế của một bản ghi sự việc (tương thích ngược dữ liệu cũ)
 */
export function getRecordScope(
  record: DisciplineRecord,
  semesterConfigs: Record<string, SchoolYearSemesterConfig> | undefined,
  fallbackSchoolYear?: string
): { schoolYear: string; semester: SemesterId } {
  if (record.schoolYear && (record.semester === 'hk1' || record.semester === 'hk2')) {
    return {
      schoolYear: normalizeSchoolYear(record.schoolYear),
      semester: record.semester,
    };
  }
  const detected = detectSemesterAndYearForDate(
    record.date,
    semesterConfigs,
    record.schoolYear || fallbackSchoolYear
  );
  return {
    schoolYear: record.schoolYear ? normalizeSchoolYear(record.schoolYear) : detected.schoolYear,
    semester: record.semester || detected.semester,
  };
}

/**
 * Xác định học kỳ đang diễn ra tại ngày hiện tại (todayStr) theo cấu hình của năm học
 */
export function getActiveSemesterForDate(
  todayStr: string,
  semesterConfigs: Record<string, SchoolYearSemesterConfig> | undefined,
  schoolYear: string
): SemesterId {
  const cfg = getSemesterConfigForYear(semesterConfigs, schoolYear);
  if (todayStr >= cfg.hk2Start) {
    return 'hk2';
  }
  return 'hk1';
}

/**
 * Lấy danh sách tất cả năm học khả dụng (từ cấu hình lớp, lịch học kỳ, lịch sử sự việc, và năm hiện tại/tiếp theo)
 */
export function getAllAvailableSchoolYears(
  state: AppState,
  todayStr?: string
): string[] {
  const yearSet = new Set<string>();

  if (state.config?.schoolYear) {
    yearSet.add(normalizeSchoolYear(state.config.schoolYear));
  }

  if (state.semesterConfigs) {
    for (const k of Object.keys(state.semesterConfigs)) {
      yearSet.add(normalizeSchoolYear(k));
    }
  }

  for (const r of state.discipline || []) {
    if (r.schoolYear) {
      yearSet.add(normalizeSchoolYear(r.schoolYear));
    } else if (r.date) {
      yearSet.add(inferNaturalSchoolYearFromDate(r.date));
    }
  }

  const refDate = todayStr || new Date().toISOString().substring(0, 10);
  const currentNatural = inferNaturalSchoolYearFromDate(refDate);
  yearSet.add(currentNatural);
  const { startYear } = parseSchoolYearBounds(currentNatural);
  yearSet.add(`${startYear + 1} - ${startYear + 2}`);

  return Array.from(yearSet).sort((a, b) => a.localeCompare(b));
}

/**
 * Lấy danh sách các tháng YYYY-MM thuộc một học kỳ hoặc cả năm học
 */
export function getMonthsInSemesterRange(
  cfg: SchoolYearSemesterConfig,
  semester: SemesterId | 'all'
): Array<{ value: string; label: string }> {
  const start = semester === 'hk2' ? cfg.hk2Start : cfg.hk1Start;
  const end = semester === 'hk1' ? cfg.hk1End : cfg.hk2End;
  if (!isValidIsoDate(start) || !isValidIsoDate(end) || start > end) return [];

  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);

  const months: Array<{ value: string; label: string }> = [];
  let y = sy;
  let m = sm;
  let guard = 0;
  while ((y < ey || (y === ey && m <= em)) && guard < 24) {
    const val = `${y}-${String(m).padStart(2, '0')}`;
    months.push({
      value: val,
      label: `Tháng ${m}/${y}`,
    });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    guard++;
  }
  return months;
}

/**
 * Lấy điểm chuẩn ban đầu cho mỗi học kỳ (mặc định 200; nâng cấp tự động cấu hình mặc định cũ 100 -> 200)
 */
export function getSemesterInitialPoints(emulationConfig?: EmulationConfig): number {
  if (!emulationConfig) return SEMESTER_BASE_POINTS;
  // Nếu là cấu hình mặc định cũ (version <= 1, initialPoints === 100, chưa sửa), áp dụng chuẩn mới 200đ/học kỳ
  if (
    emulationConfig.initialPoints === 100 &&
    (emulationConfig.version || 1) <= 1 &&
    emulationConfig.appliedAt === '2024-09-01'
  ) {
    return SEMESTER_BASE_POINTS;
  }
  return Number.isFinite(emulationConfig.initialPoints)
    ? emulationConfig.initialPoints
    : SEMESTER_BASE_POINTS;
}

/**
 * Chuẩn hóa EmulationConfig cho hệ thống tính điểm theo từng học kỳ (200đ/HK)
 */
export function normalizeSemesterEmulationConfig(
  emulationConfig?: EmulationConfig
): EmulationConfig {
  const base = emulationConfig || DEFAULT_EMULATION_CONFIG;
  const initialPoints = getSemesterInitialPoints(base);
  return {
    ...base,
    initialPoints,
  };
}

/**
 * Lọc danh sách sự việc kỷ luật/thi đua theo Năm học + Học kỳ (độc lập, không cộng dồn giữa 2 học kỳ)
 */
export function filterRecordsForSemester(
  allRecords: DisciplineRecord[],
  schoolYear: string,
  semester: SemesterId,
  semesterConfigs?: Record<string, SchoolYearSemesterConfig>,
  fallbackSchoolYear?: string,
  monthFilter?: string
): DisciplineRecord[] {
  const targetYear = normalizeSchoolYear(schoolYear);
  return (allRecords || []).filter((r) => {
    const scope = getRecordScope(r, semesterConfigs, fallbackSchoolYear);
    if (scope.schoolYear !== targetYear || scope.semester !== semester) {
      return false;
    }
    if (monthFilter && monthFilter !== 'all') {
      return Boolean(r.date && r.date.startsWith(monthFilter));
    }
    return true;
  });
}

/**
 * Tính điểm thi đua và xếp loại gợi ý cho 1 học sinh trong 1 học kỳ độc lập:
 * Điểm thi đua học kỳ = 200 + Tổng điểm thưởng trong học kỳ - Tổng điểm trừ trong học kỳ
 */
export function evaluateSemesterEmulation(
  studentId: string,
  allRecords: DisciplineRecord[],
  schoolYear: string,
  semester: SemesterId,
  semesterConfigs?: Record<string, SchoolYearSemesterConfig>,
  emulationConfig?: EmulationConfig,
  fallbackSchoolYear?: string,
  monthFilter?: string
): StudentEvaluationResult {
  const semesterRecords = filterRecordsForSemester(
    allRecords,
    schoolYear,
    semester,
    semesterConfigs,
    fallbackSchoolYear,
    monthFilter
  );
  const effectiveConfig = normalizeSemesterEmulationConfig(emulationConfig);
  return evaluateStudentEmulation(studentId, semesterRecords, effectiveConfig);
}

/**
 * Key lưu đánh giá rèn luyện chính thức theo từng năm học và học kỳ
 */
export function getOfficialConductKey(schoolYear: string, semester: SemesterId): string {
  return `${normalizeSchoolYear(schoolYear)}_${semester}`;
}

/**
 * Lấy đánh giá rèn luyện chính thức của học sinh cho đúng học kỳ
 */
export function getOfficialConductForSemester(
  student: Student | undefined,
  schoolYear: string,
  semester: SemesterId
): OfficialConductEvaluation | undefined {
  if (!student) return undefined;
  const key = getOfficialConductKey(schoolYear, semester);
  if (student.officialConductByPeriod && student.officialConductByPeriod[key]) {
    return student.officialConductByPeriod[key];
  }
  // Tương thích ngược nếu học sinh có đánh giá cũ trước khi tách HK1/HK2
  if (!student.officialConductByPeriod && semester === 'hk1' && student.officialConduct) {
    return student.officialConduct;
  }
  return undefined;
}

/**
 * Format nhãn học kỳ tiếng Việt
 */
export function getSemesterLabel(semester: SemesterId): string {
  return semester === 'hk1' ? 'Học kỳ I' : 'Học kỳ II';
}

export function getSemesterShortLabel(semester: SemesterId): string {
  return semester === 'hk1' ? 'HK I' : 'HK II';
}

export function getSuggestedRatingBadgeClass(rating: ConductGrade): string {
  if (rating === 'Tốt') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (rating === 'Khá') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (rating === 'Đạt') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-rose-50 text-rose-700 border-rose-200';
}

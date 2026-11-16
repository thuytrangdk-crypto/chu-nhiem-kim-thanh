import ExcelJS from 'exceljs';
import {
  AppState,
  DisciplineRecord,
  EmulationConfig,
  SchoolYearSemesterConfig,
  SemesterId,
  Student,
} from '../types';
import { formatViDate } from './helpers';
import { getEmulationConfigForClass } from './emulationEvaluation';
import {
  evaluateSemesterEmulation,
  filterRecordsForSemester,
  getRecordScope,
  getSemesterConfigForYear,
  getSemesterLabel,
  normalizeSchoolYear,
  normalizeSemesterEmulationConfig,
} from './semesterUtils';

export interface EmulationPeriodInfo {
  type: 'week' | 'month' | 'semester' | 'year' | 'custom';
  label: string; // e.g. "Học kỳ 1 Năm học 2026 - 2027 (01/09/2026 - 15/01/2027)"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  schoolYear?: string;
  semester?: SemesterId;
}

export interface StudentEmulationSummary {
  student: Student;
  basePoints: number; // Điểm ban đầu (mặc định 200 cho mỗi học kỳ)
  plusPoints: number; // positive number
  minusPoints: number; // positive number
  totalPoints: number; // basePoints + plus - minus
  netPoints: number; // plus - minus
  rating: 'Tốt' | 'Khá' | 'Đạt' | 'Chưa đạt';
  rank: number;
  positiveCount: number;
  negativeCount: number;
  notes: string;
}

/**
 * Xếp loại gợi ý theo thi đua:
 * Tốt: Điểm >= T
 * Khá: K <= Điểm < T
 * Đạt: D <= Điểm < K
 * Chưa đạt: Điểm < D
 */
export function getConductRatingFromScore(
  totalPoints: number,
  t: number = 105,
  k: number = 90,
  d: number = 70
): 'Tốt' | 'Khá' | 'Đạt' | 'Chưa đạt' {
  if (totalPoints >= t) return 'Tốt';
  if (totalPoints >= k) return 'Khá';
  if (totalPoints >= d) return 'Đạt';
  return 'Chưa đạt';
}

/**
 * Tính toán dữ liệu tổng hợp thi đua cho toàn bộ học sinh trong kỳ báo cáo (tuần / tháng / học kỳ / tùy chọn)
 */
export function calculateEmulationData(
  students: Student[],
  disciplineRecords: DisciplineRecord[],
  startDate: string,
  endDate: string,
  className: string,
  emulationConfig?: EmulationConfig,
  semesterFilter?: {
    schoolYear: string;
    semester: SemesterId;
    semesterConfigs?: Record<string, SchoolYearSemesterConfig>;
    fallbackSchoolYear?: string;
  }
): {
  summaries: StudentEmulationSummary[];
  periodRecords: (DisciplineRecord & { studentName: string })[];
} {
  const seenIds = new Set<string>();
  const periodRecords: (DisciplineRecord & { studentName: string })[] = [];

  const studentMap = new Map<string, Student>();
  students.forEach((s) => studentMap.set(s.id, s));

  // Nếu có chỉ định lọc chính xác theo (năm học + học kỳ), sử dụng filterRecordsForSemester để bảo toàn độc lập giữa 2 học kỳ
  const sourceRecords = semesterFilter
    ? filterRecordsForSemester(
        disciplineRecords,
        semesterFilter.schoolYear,
        semesterFilter.semester,
        semesterFilter.semesterConfigs,
        semesterFilter.fallbackSchoolYear
      )
    : disciplineRecords.filter((r) => Boolean(r && r.date && r.date >= startDate && r.date <= endDate));

  for (const r of sourceRecords) {
    if (!r || !r.date) continue;
    if (r.id && seenIds.has(r.id)) continue;
    if (r.id) seenIds.add(r.id);

    const student = studentMap.get(r.studentId);
    periodRecords.push({
      ...r,
      studentName: student ? student.name : `Học sinh (${r.studentId})`,
    });
  }

  periodRecords.sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return a.studentName.localeCompare(b.studentName);
  });

  const normalizedConfig = normalizeSemesterEmulationConfig(emulationConfig);
  const basePoints = normalizedConfig.initialPoints;
  const totTierVal = normalizedConfig.conductTiers?.find((t) => t.id === 'tot')?.minScore;
  const totTier = totTierVal !== undefined && Number.isFinite(totTierVal) ? totTierVal : 105;
  const khaTierVal = normalizedConfig.conductTiers?.find((t) => t.id === 'kha')?.minScore;
  const khaTier = khaTierVal !== undefined && Number.isFinite(khaTierVal) ? khaTierVal : 90;
  const datTierVal = normalizedConfig.conductTiers?.find((t) => t.id === 'dat')?.minScore;
  const datTier = datTierVal !== undefined && Number.isFinite(datTierVal) ? datTierVal : 70;

  const studentSummariesRaw = students.map((student) => {
    const studentRecords = periodRecords.filter((r) => r.studentId === student.id);
    let plusPoints = 0;
    let minusPoints = 0;
    let positiveCount = 0;
    let negativeCount = 0;

    for (const r of studentRecords) {
      const pts = r.points || 0;
      if (pts > 0) {
        plusPoints += pts;
        positiveCount++;
      } else if (pts < 0) {
        minusPoints += Math.abs(pts);
        negativeCount++;
      }
    }

    const netPoints = plusPoints - minusPoints;
    const totalPoints = basePoints + netPoints;
    const rating = getConductRatingFromScore(totalPoints, totTier, khaTier, datTier);

    const notesParts: string[] = [];
    if (student.position && student.position !== 'Học sinh') {
      notesParts.push(student.position);
    }
    if (positiveCount > 0 && negativeCount === 0) {
      notesParts.push(`Tích cực (${positiveCount} lần)`);
    } else if (negativeCount > 0 && positiveCount === 0) {
      notesParts.push(`Có vi phạm (${negativeCount} lần)`);
    } else if (positiveCount === 0 && negativeCount === 0) {
      notesParts.push('Nề nếp ổn định');
    }

    return {
      student,
      basePoints,
      plusPoints,
      minusPoints,
      totalPoints,
      netPoints,
      rating,
      positiveCount,
      negativeCount,
      notes: notesParts.join(' • '),
    };
  });

  studentSummariesRaw.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    return a.student.id.localeCompare(b.student.id);
  });

  let currentRank = 1;
  const summaries: StudentEmulationSummary[] = studentSummariesRaw.map((item, index) => {
    if (index > 0 && item.totalPoints < studentSummariesRaw[index - 1].totalPoints) {
      currentRank = index + 1;
    }
    return {
      ...item,
      rank: currentRank,
    };
  });

  return { summaries, periodRecords };
}

/**
 * Phòng tránh formula injection cho ô Excel
 */
function sanitizeStringForExcel(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/^[=\-+@\t\r]/.test(str)) {
    return "'" + str;
  }
  return str;
}

function getRatingArgb(rating: string): string {
  if (rating === 'Tốt') return 'FF059669';
  if (rating === 'Khá') return 'FF2563EB';
  if (rating === 'Đạt') return 'FFD97706';
  return 'FFE11D48';
}

/**
 * Xuất file Excel .xlsx gồm 2 Sheet:
 * 1. Sheet "Tổng hợp thi đua" (Khi xuất Cả năm sẽ tách biệt hoàn toàn các cột HK I và HK II, không gộp 400đ)
 * 2. Sheet "Chi tiết ghi nhận" (Ghi rõ cột Học kỳ cho từng sự việc)
 */
export async function exportEmulationToExcel(
  state: AppState,
  periodInfo: EmulationPeriodInfo
): Promise<{
  success: boolean;
  fileName: string;
  totalStudents: number;
  totalRecords: number;
  buffer?: ArrayBuffer | Uint8Array;
  error?: string;
}> {
  const students = state.students || [];
  if (students.length === 0) {
    throw new Error('Chưa có danh sách học sinh của lớp để xuất báo cáo thi đua.');
  }

  const schoolName = state.config.schoolName || 'Trường THCS Chu Văn An';
  const className = state.config.className || '6A8';
  const teacherName = state.config.teacherName || 'Cô Lê Thị Kim Thanh';
  const schoolYear = normalizeSchoolYear(periodInfo.schoolYear || state.config.schoolYear || '2026 - 2027');

  const activeConfig = getEmulationConfigForClass(
    state.classEmulationConfigs,
    state.emulationConfig,
    className,
    schoolYear
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = state.config.appName || 'Trợ Lý Chủ Nhiệm';
  workbook.lastModifiedBy = teacherName;
  workbook.created = new Date();
  workbook.modified = new Date();

  const now = new Date();
  const exportTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ngày ${formatViDate(
    now.toISOString().substring(0, 10)
  )}`;

  const isWholeYearReport = periodInfo.type === 'year';

  // Chuẩn bị dữ liệu cho Sheet 2 (Chi tiết ghi nhận)
  let detailRecords: (DisciplineRecord & { studentName: string; semesterLabel: string })[] = [];

  if (isWholeYearReport) {
    // ========================================================
    // TRƯỜNG HỢP 1: BÁO CÁO CẢ NĂM (TÁCH RIÊNG CỘT HK I & HK II)
    // ========================================================
    const hk1Data = students.map((student) => {
      const hk1 = evaluateSemesterEmulation(
        student.id,
        state.discipline || [],
        schoolYear,
        'hk1',
        state.semesterConfigs,
        activeConfig,
        state.config.schoolYear
      );
      const hk2 = evaluateSemesterEmulation(
        student.id,
        state.discipline || [],
        schoolYear,
        'hk2',
        state.semesterConfigs,
        activeConfig,
        state.config.schoolYear
      );
      return { student, hk1, hk2 };
    });

    const hk1Records = filterRecordsForSemester(
      state.discipline || [],
      schoolYear,
      'hk1',
      state.semesterConfigs,
      state.config.schoolYear
    );
    const hk2Records = filterRecordsForSemester(
      state.discipline || [],
      schoolYear,
      'hk2',
      state.semesterConfigs,
      state.config.schoolYear
    );

    const studentMap = new Map<string, Student>();
    students.forEach((s) => studentMap.set(s.id, s));

    const combined = [
      ...hk1Records.map((r) => ({
        ...r,
        studentName: studentMap.get(r.studentId)?.name || `Học sinh (${r.studentId})`,
        semesterLabel: 'Học kỳ I',
      })),
      ...hk2Records.map((r) => ({
        ...r,
        studentName: studentMap.get(r.studentId)?.name || `Học sinh (${r.studentId})`,
        semesterLabel: 'Học kỳ II',
      })),
    ];
    combined.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return a.studentName.localeCompare(b.studentName);
    });
    detailRecords = combined;

    const ws1 = workbook.addWorksheet('Tổng hợp thi đua', {
      views: [{ state: 'frozen', ySplit: 6 }],
      properties: { defaultRowHeight: 22 },
    });

    ws1.mergeCells('A1:E1');
    const schoolCell = ws1.getCell('A1');
    schoolCell.value = schoolName.toUpperCase();
    schoolCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
    schoolCell.alignment = { vertical: 'middle', horizontal: 'left' };

    ws1.mergeCells('F1:O1');
    const countryCell = ws1.getCell('F1');
    countryCell.value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM - Độc lập - Tự do - Hạnh phúc';
    countryCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
    countryCell.alignment = { vertical: 'middle', horizontal: 'right' };

    ws1.mergeCells('A2:O2');
    const titleCell = ws1.getCell('A2');
    titleCell.value = `BẢNG TỔNG HỢP ĐIỂM THI ĐUA CẢ NĂM (TÁCH RIÊNG HK I & HK II) - LỚP ${className.toUpperCase()}`;
    titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FF1E293B' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws1.getRow(2).height = 32;

    ws1.mergeCells('A3:O3');
    const subtitleCell = ws1.getCell('A3');
    subtitleCell.value = `Kỳ báo cáo: ${periodInfo.label}  |  Năm học: ${schoolYear}  |  Mỗi học kỳ khởi tạo độc lập 200đ`;
    subtitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF334155' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    ws1.mergeCells('A4:O4');
    const metaCell = ws1.getCell('A4');
    metaCell.value = `Giáo viên chủ nhiệm: ${teacherName}  •  Thời gian xuất: ${exportTimeStr}  •  Sĩ số: ${students.length} học sinh`;
    metaCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'center' };

    ws1.getRow(5).height = 8;

    const headersYear = [
      'STT',
      'Mã hồ sơ học sinh',
      'Họ và tên',
      'Lớp',
      'Điểm chuẩn HK I',
      'Thưởng HK I',
      'Trừ HK I',
      'Điểm thi đua HK I',
      'Xếp loại HK I',
      'Điểm chuẩn HK II',
      'Thưởng HK II',
      'Trừ HK II',
      'Điểm thi đua HK II',
      'Xếp loại HK II',
      'Ghi chú',
    ];

    const headerRow1 = ws1.getRow(6);
    headerRow1.values = headersYear;
    headerRow1.height = 32;
    headerRow1.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEDB5C1' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'medium', color: { argb: 'FF475569' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } },
      };
    });

    ws1.autoFilter = {
      from: { row: 6, column: 1 },
      to: { row: 6, column: headersYear.length },
    };

    const startRowIndex1 = 7;
    hk1Data.forEach(({ student, hk1, hk2 }, idx) => {
      const row = ws1.getRow(startRowIndex1 + idx);
      row.height = 24;
      const noteText =
        student.position && student.position !== 'Học sinh' ? student.position : '';

      row.values = [
        idx + 1,
        student.id,
        student.name,
        className,
        hk1.initialPoints,
        hk1.plusPoints,
        hk1.minusPoints,
        hk1.finalTotalPoints,
        hk1.suggestedRating,
        hk2.initialPoints,
        hk2.plusPoints,
        hk2.minusPoints,
        hk2.finalTotalPoints,
        hk2.suggestedRating,
        noteText,
      ];

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if (idx % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFDF2F8' },
          };
        }

        switch (colNumber) {
          case 1:
          case 4:
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            break;
          case 2:
            cell.numFmt = '@';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            break;
          case 3:
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.font = { name: 'Calibri', size: 10, bold: true };
            break;
          case 5:
          case 10:
            cell.numFmt = '#,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            break;
          case 6:
          case 11:
            cell.numFmt = '#,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF059669' } };
            break;
          case 7:
          case 12:
            cell.numFmt = '#,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFE11D48' } };
            break;
          case 8:
          case 13:
            cell.numFmt = '#,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
            break;
          case 9:
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = {
              name: 'Calibri',
              size: 10,
              bold: true,
              color: { argb: getRatingArgb(hk1.suggestedRating) },
            };
            break;
          case 14:
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = {
              name: 'Calibri',
              size: 10,
              bold: true,
              color: { argb: getRatingArgb(hk2.suggestedRating) },
            };
            break;
          case 15:
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            break;
        }
      });
    });

    ws1.columns = [
      { width: 6 },
      { width: 17 },
      { width: 24 },
      { width: 9 },
      { width: 13 },
      { width: 12 },
      { width: 11 },
      { width: 15 },
      { width: 14 },
      { width: 13 },
      { width: 12 },
      { width: 11 },
      { width: 15 },
      { width: 14 },
      { width: 22 },
    ];
  } else {
    // ========================================================
    // TRƯỜNG HỢP 2: BÁO CÁO 1 HỌC KỲ / THÁNG / TUẦN / TÙY CHỌN
    // ========================================================
    const semesterFilter =
      periodInfo.type === 'semester' && periodInfo.semester
        ? {
            schoolYear,
            semester: periodInfo.semester,
            semesterConfigs: state.semesterConfigs,
            fallbackSchoolYear: state.config.schoolYear,
          }
        : undefined;

    const { summaries, periodRecords } = calculateEmulationData(
      students,
      state.discipline || [],
      periodInfo.startDate,
      periodInfo.endDate,
      className,
      activeConfig,
      semesterFilter
    );

    detailRecords = periodRecords.map((r) => {
      const scope = getRecordScope(r, state.semesterConfigs, state.config.schoolYear);
      return {
        ...r,
        semesterLabel: getSemesterLabel(scope.semester),
      };
    });

    const ws1 = workbook.addWorksheet('Tổng hợp thi đua', {
      views: [{ state: 'frozen', ySplit: 6 }],
      properties: { defaultRowHeight: 22 },
    });

    ws1.mergeCells('A1:E1');
    const schoolCell = ws1.getCell('A1');
    schoolCell.value = schoolName.toUpperCase();
    schoolCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
    schoolCell.alignment = { vertical: 'middle', horizontal: 'left' };

    ws1.mergeCells('F1:M1');
    const countryCell = ws1.getCell('F1');
    countryCell.value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM - Độc lập - Tự do - Hạnh phúc';
    countryCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
    countryCell.alignment = { vertical: 'middle', horizontal: 'right' };

    ws1.mergeCells('A2:M2');
    const titleCell = ws1.getCell('A2');
    titleCell.value = `BẢNG TỔNG HỢP ĐIỂM THI ĐUA NỀ NẾP - LỚP ${className.toUpperCase()}`;
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1E293B' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws1.getRow(2).height = 32;

    ws1.mergeCells('A3:M3');
    const subtitleCell = ws1.getCell('A3');
    subtitleCell.value = `Kỳ báo cáo: ${periodInfo.label}  |  Năm học: ${schoolYear}`;
    subtitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF334155' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    ws1.mergeCells('A4:M4');
    const metaCell = ws1.getCell('A4');
    metaCell.value = `Giáo viên chủ nhiệm: ${teacherName}  •  Thời gian xuất: ${exportTimeStr}  •  Sĩ số: ${students.length} học sinh`;
    metaCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'center' };

    ws1.getRow(5).height = 8;

    const headers1 = [
      'STT',
      'Mã hồ sơ học sinh',
      'Họ và tên',
      'Lớp',
      'Điểm ban đầu',
      'Tổng điểm cộng',
      'Tổng điểm trừ',
      'Tổng điểm thi đua',
      'Xếp loại thi đua',
      'Xếp hạng',
      'Số lượt ghi nhận tích cực',
      'Số lượt ghi nhận vi phạm',
      'Ghi chú',
    ];

    const headerRow1 = ws1.getRow(6);
    headerRow1.values = headers1;
    headerRow1.height = 30;

    headerRow1.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEDB5C1' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'medium', color: { argb: 'FF475569' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } },
      };
    });

    ws1.autoFilter = {
      from: { row: 6, column: 1 },
      to: { row: 6, column: headers1.length },
    };

    const startRowIndex1 = 7;
    summaries.forEach((sum, idx) => {
      const row = ws1.getRow(startRowIndex1 + idx);
      row.height = 24;

      row.values = [
        idx + 1,
        sum.student.id,
        sum.student.name,
        className,
        sum.basePoints,
        sum.plusPoints,
        sum.minusPoints,
        sum.totalPoints,
        sum.rating,
        sum.rank,
        sum.positiveCount,
        sum.negativeCount,
        sum.notes,
      ];

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if (idx % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFDF2F8' },
          };
        }

        switch (colNumber) {
          case 1:
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            break;
          case 2:
            cell.numFmt = '@';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            break;
          case 3:
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.font = { name: 'Calibri', size: 10, bold: true };
            break;
          case 4:
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            break;
          case 5:
            cell.numFmt = '#,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            break;
          case 6:
            cell.numFmt = '#,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF059669' } };
            break;
          case 7:
            cell.numFmt = '#,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFE11D48' } };
            break;
          case 8:
            cell.numFmt = '#,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
            break;
          case 9:
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = {
              name: 'Calibri',
              size: 10,
              bold: true,
              color: { argb: getRatingArgb(sum.rating) },
            };
            break;
          case 10:
            cell.numFmt = '#,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Calibri', size: 10, bold: true };
            if (sum.rank === 1) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
            }
            break;
          case 11:
          case 12:
            cell.numFmt = '#,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            break;
          case 13:
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            break;
        }
      });
    });

    const endRowIndex1 = startRowIndex1 + summaries.length;
    const summaryRow1 = ws1.getRow(endRowIndex1 + 1);
    summaryRow1.height = 26;
    summaryRow1.getCell(3).value = 'TỔNG CỘNG LỚP';
    summaryRow1.getCell(3).font = { name: 'Calibri', size: 10, bold: true };
    summaryRow1.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };

    const totalPlus = summaries.reduce((s, c) => s + c.plusPoints, 0);
    const totalMinus = summaries.reduce((s, c) => s + c.minusPoints, 0);
    const totalPositiveEvents = summaries.reduce((s, c) => s + c.positiveCount, 0);
    const totalNegativeEvents = summaries.reduce((s, c) => s + c.negativeCount, 0);

    summaryRow1.getCell(6).value = totalPlus;
    summaryRow1.getCell(6).numFmt = '#,##0';
    summaryRow1.getCell(6).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF059669' } };
    summaryRow1.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };

    summaryRow1.getCell(7).value = totalMinus;
    summaryRow1.getCell(7).numFmt = '#,##0';
    summaryRow1.getCell(7).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFE11D48' } };
    summaryRow1.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };

    summaryRow1.getCell(11).value = totalPositiveEvents;
    summaryRow1.getCell(11).numFmt = '#,##0';
    summaryRow1.getCell(11).font = { name: 'Calibri', size: 10, bold: true };
    summaryRow1.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };

    summaryRow1.getCell(12).value = totalNegativeEvents;
    summaryRow1.getCell(12).numFmt = '#,##0';
    summaryRow1.getCell(12).font = { name: 'Calibri', size: 10, bold: true };
    summaryRow1.getCell(12).alignment = { vertical: 'middle', horizontal: 'center' };

    summaryRow1.eachCell((cell) => {
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF64748B' } },
        bottom: { style: 'double', color: { argb: 'FF64748B' } },
      };
    });

    ws1.columns = [
      { width: 6 },
      { width: 18 },
      { width: 24 },
      { width: 10 },
      { width: 14 },
      { width: 15 },
      { width: 15 },
      { width: 18 },
      { width: 16 },
      { width: 12 },
      { width: 16 },
      { width: 16 },
      { width: 26 },
    ];
  }

  // ==========================================
  // SHEET 2: "Chi tiết ghi nhận"
  // ==========================================
  const ws2 = workbook.addWorksheet('Chi tiết ghi nhận', {
    views: [{ state: 'frozen', ySplit: 5 }],
    properties: { defaultRowHeight: 22 },
  });

  ws2.mergeCells('A1:D1');
  const schoolCell2 = ws2.getCell('A1');
  schoolCell2.value = schoolName.toUpperCase();
  schoolCell2.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  schoolCell2.alignment = { vertical: 'middle', horizontal: 'left' };

  ws2.mergeCells('A2:I2');
  const titleCell2 = ws2.getCell('A2');
  titleCell2.value = `NHẬT KÝ CHI TIẾT SỰ VIỆC THI ĐUA & NỀ NẾP - LỚP ${className.toUpperCase()}`;
  titleCell2.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FF0284C7' } };
  titleCell2.alignment = { vertical: 'middle', horizontal: 'center' };
  ws2.getRow(2).height = 30;

  ws2.mergeCells('A3:I3');
  const metaCell2 = ws2.getCell('A3');
  metaCell2.value = `Kỳ báo cáo: ${periodInfo.label}  •  GVCN: ${teacherName}  •  Tổng cộng: ${detailRecords.length} lượt ghi nhận`;
  metaCell2.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
  metaCell2.alignment = { vertical: 'middle', horizontal: 'center' };

  ws2.getRow(4).height = 8;

  const headers2 = [
    'Thời gian',
    'Học kỳ',
    'Mã hồ sơ học sinh',
    'Họ và tên',
    'Nội dung sự việc',
    'Loại ghi nhận',
    'Điểm cộng/trừ có dấu',
    'Người ghi nhận',
    'Ghi chú',
  ];

  const headerRow2 = ws2.getRow(5);
  headerRow2.values = headers2;
  headerRow2.height = 28;

  headerRow2.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0369A1' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF0C4A6E' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  });

  ws2.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5, column: headers2.length },
  };

  const startRowIndex2 = 6;
  if (detailRecords.length === 0) {
    const emptyRow = ws2.getRow(startRowIndex2);
    ws2.mergeCells(`A${startRowIndex2}:I${startRowIndex2}`);
    emptyRow.getCell(1).value = 'Không có sự việc vi phạm hay khen thưởng nào được ghi nhận trong khoảng thời gian này.';
    emptyRow.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
    emptyRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    emptyRow.height = 36;
  } else {
    detailRecords.forEach((rec, idx) => {
      const row = ws2.getRow(startRowIndex2 + idx);
      row.height = 24;

      const isPositive = (rec.points || 0) > 0;
      const pointsFormatted = isPositive ? `+${rec.points}đ` : `${rec.points}đ`;
      const recordTypeStr = isPositive ? 'Tích cực' : 'Vi phạm';
      const authorStr = sanitizeStringForExcel(rec.author || teacherName);

      row.values = [
        formatViDate(rec.date),
        rec.semesterLabel,
        rec.studentId,
        rec.studentName,
        sanitizeStringForExcel(rec.ruleName),
        recordTypeStr,
        pointsFormatted,
        authorStr,
        sanitizeStringForExcel(rec.note || ''),
      ];

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if (idx % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF0F9FF' },
          };
        }

        switch (colNumber) {
          case 1:
          case 2:
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            break;
          case 3:
            cell.numFmt = '@';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            break;
          case 4:
            cell.font = { name: 'Calibri', size: 10, bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            break;
          case 5:
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            break;
          case 6:
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = {
              name: 'Calibri',
              size: 10,
              bold: true,
              color: { argb: isPositive ? 'FF059669' : 'FFE11D48' },
            };
            break;
          case 7:
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = {
              name: 'Calibri',
              size: 10,
              bold: true,
              color: { argb: isPositive ? 'FF059669' : 'FFE11D48' },
            };
            break;
          case 8:
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            break;
          case 9:
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            break;
        }
      });
    });
  }

  ws2.columns = [
    { width: 14 },
    { width: 12 },
    { width: 18 },
    { width: 24 },
    { width: 34 },
    { width: 15 },
    { width: 16 },
    { width: 22 },
    { width: 30 },
  ];

  const cleanClassName = className.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fromDateClean = formatViDate(periodInfo.startDate).replace(/\//g, '-');
  const toDateClean = formatViDate(periodInfo.endDate).replace(/\//g, '-');
  const fileName = `Thi_dua_${cleanClassName}_${fromDateClean}_${toDateClean}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return {
    success: true,
    fileName,
    totalStudents: students.length,
    totalRecords: detailRecords.length,
    buffer: buffer as ArrayBuffer,
  };
}

import ExcelJS from 'exceljs';
import { AppState, DisciplineRecord, EmulationConfig, Student } from '../types';
import { formatViDate } from './helpers';
import { getEmulationConfigForClass } from './emulationEvaluation';

export interface EmulationPeriodInfo {
  type: 'week' | 'month' | 'semester' | 'year' | 'custom';
  label: string; // e.g. "Tuần 42 (13/10/2024 - 19/10/2024)"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface StudentEmulationSummary {
  student: Student;
  basePoints: number; // Điểm ban đầu
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
 * Tính toán dữ liệu tổng hợp thi đua cho toàn bộ học sinh trong kỳ báo cáo
 */
export function calculateEmulationData(
  students: Student[],
  disciplineRecords: DisciplineRecord[],
  startDate: string,
  endDate: string,
  className: string,
  emulationConfig?: EmulationConfig
): {
  summaries: StudentEmulationSummary[];
  periodRecords: (DisciplineRecord & { studentName: string })[];
} {
  // 1. Lọc các sự việc trong khoảng ngày và loại bỏ trùng lặp id
  const seenIds = new Set<string>();
  const periodRecords: (DisciplineRecord & { studentName: string })[] = [];

  const studentMap = new Map<string, Student>();
  students.forEach((s) => studentMap.set(s.id, s));

  // Lọc chính xác theo định dạng YYYY-MM-DD bao gồm trọn ngày bắt đầu và kết thúc
  for (const r of disciplineRecords) {
    if (!r || !r.date) continue;
    if (r.id && seenIds.has(r.id)) continue;
    if (r.id) seenIds.add(r.id);

    // So khớp theo thứ tự ngày chuẩn ISO YYYY-MM-DD
    if (r.date >= startDate && r.date <= endDate) {
      const student = studentMap.get(r.studentId);
      periodRecords.push({
        ...r,
        studentName: student ? student.name : `Học sinh (${r.studentId})`,
      });
    }
  }

  // Sắp xếp chi tiết sự việc theo ngày tăng dần rồi giảm dần
  periodRecords.sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return a.studentName.localeCompare(b.studentName);
  });

  // 2. Tính điểm cho tất cả học sinh của lớp theo thang điểm đã cấu hình
  const basePoints =
    emulationConfig?.initialPoints !== undefined && Number.isFinite(emulationConfig.initialPoints)
      ? emulationConfig.initialPoints
      : 100;
  const totTierVal = emulationConfig?.conductTiers?.find((t) => t.id === 'tot')?.minScore;
  const totTier = totTierVal !== undefined && Number.isFinite(totTierVal) ? totTierVal : 105;
  const khaTierVal = emulationConfig?.conductTiers?.find((t) => t.id === 'kha')?.minScore;
  const khaTier = khaTierVal !== undefined && Number.isFinite(khaTierVal) ? khaTierVal : 90;
  const datTierVal = emulationConfig?.conductTiers?.find((t) => t.id === 'dat')?.minScore;
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

    // Ghi chú ngắn gọn nếu có chức vụ hoặc ghi chú
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

  // 3. Sắp xếp giảm dần theo tổng điểm thi đua; nếu bằng điểm thì sắp xếp ổn định theo mã học sinh
  studentSummariesRaw.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    return a.student.id.localeCompare(b.student.id);
  });

  // 4. Xếp hạng: Học sinh bằng điểm có cùng thứ hạng
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
  // Nếu bắt đầu bằng ký tự công thức, thêm dấu nháy đơn để Excel coi là text
  if (/^[=\-+@\t\r]/.test(str)) {
    return "'" + str;
  }
  return str;
}

/**
 * Xuất file Excel .xlsx gồm 2 Sheet:
 * 1. Sheet "Tổng hợp thi đua"
 * 2. Sheet "Chi tiết ghi nhận"
 */
export async function exportEmulationToExcel(
  state: AppState,
  periodInfo: EmulationPeriodInfo
): Promise<{ success: boolean; fileName: string; totalStudents: number; totalRecords: number; error?: string }> {
  const students = state.students || [];
  if (students.length === 0) {
    throw new Error('Chưa có danh sách học sinh của lớp để xuất báo cáo thi đua.');
  }

  const activeConfig = getEmulationConfigForClass(
    state.classEmulationConfigs,
    state.emulationConfig,
    state.config.className,
    state.config.schoolYear
  );

  const { summaries, periodRecords } = calculateEmulationData(
    students,
    state.discipline || [],
    periodInfo.startDate,
    periodInfo.endDate,
    state.config.className,
    activeConfig
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = state.config.appName || 'Trợ Lý Chủ Nhiệm';
  workbook.lastModifiedBy = state.config.teacherName || 'Giáo viên Chủ nhiệm';
  workbook.created = new Date();
  workbook.modified = new Date();

  const schoolName = state.config.schoolName || 'Trường THCS Chu Văn An';
  const className = state.config.className || '8A3';
  const teacherName = state.config.teacherName || 'Cô Lê Thị Kim Thanh';
  const schoolYear = state.config.schoolYear || '2024 - 2025';

  // Định dạng ngày giờ xuất theo múi giờ Việt Nam
  const now = new Date();
  const exportTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ngày ${formatViDate(
    now.toISOString().substring(0, 10)
  )}`;

  // ==========================================
  // SHEET 1: "Tổng hợp thi đua"
  // ==========================================
  const ws1 = workbook.addWorksheet('Tổng hợp thi đua', {
    views: [{ state: 'frozen', ySplit: 6 }], // Cố định tiêu đề bảng ở dòng 6
    properties: { defaultRowHeight: 22 },
  });

  // Hàng 1: Tên Trường & Tiêu ngữ
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

  // Hàng 2: Tiêu đề Bảng Tổng hợp
  ws1.mergeCells('A2:M2');
  const titleCell = ws1.getCell('A2');
  titleCell.value = `BẢNG TỔNG HỢP ĐIỂM THI ĐUA NỀ NẾP - LỚP ${className.toUpperCase()}`;
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1E293B' } }; // Màu xanh đen đậm trang nhã
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws1.getRow(2).height = 32;

  // Hàng 3: Kỳ báo cáo & Năm học
  ws1.mergeCells('A3:M3');
  const subtitleCell = ws1.getCell('A3');
  subtitleCell.value = `Kỳ báo cáo: ${periodInfo.label}  |  Năm học: ${schoolYear}`;
  subtitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF334155' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Hàng 4: Thông tin Giáo viên & Thời gian xuất
  ws1.mergeCells('A4:M4');
  const metaCell = ws1.getCell('A4');
  metaCell.value = `Giáo viên chủ nhiệm: ${teacherName}  •  Thời gian xuất: ${exportTimeStr}  •  Sĩ số: ${students.length} học sinh`;
  metaCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
  metaCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Hàng 5: Khoảng trống đệm
  ws1.getRow(5).height = 8;

  // Hàng 6: Tiêu đề cột
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
      fgColor: { argb: 'FFEDB5C1' }, // Màu hồng pastel #EDB5C1
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  });

  // Bật bộ lọc (AutoFilter) cho toàn bộ tiêu đề cột
  ws1.autoFilter = {
    from: { row: 6, column: 1 },
    to: { row: 6, column: headers1.length },
  };

  // Nạp dữ liệu các dòng học sinh
  let startRowIndex1 = 7;
  summaries.forEach((sum, idx) => {
    const row = ws1.getRow(startRowIndex1 + idx);
    row.height = 24;

    // Dữ liệu dòng: Mã học sinh lưu kiểu văn bản, điểm số lưu kiểu số
    row.values = [
      idx + 1, // STT: kiểu số
      sum.student.id, // Mã hồ sơ: kiểu văn bản
      sum.student.name,
      className,
      sum.basePoints, // Điểm ban đầu: kiểu số
      sum.plusPoints, // Tổng điểm cộng: kiểu số
      sum.minusPoints, // Tổng điểm trừ: kiểu số (dương)
      sum.totalPoints, // Tổng điểm thi đua: kiểu số
      sum.rating, // Xếp loại
      sum.rank, // Xếp hạng: kiểu số
      sum.positiveCount, // Số lượt tích cực: kiểu số
      sum.negativeCount, // Số lượt vi phạm: kiểu số
      sum.notes, // Ghi chú
    ];

    // Định dạng từng ô trong dòng
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      // Xen kẽ màu dòng chẵn lẻ nhẹ
      if (idx % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFDF2F8' }, // Hồng phấn siêu nhạt
        };
      }

      // Căn chỉnh vị trí & định dạng số/chuỗi
      switch (colNumber) {
        case 1: // STT
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          break;
        case 2: // Mã hồ sơ: Bắt buộc là text '@' để bảo toàn số 0 ở đầu
          cell.numFmt = '@';
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          break;
        case 3: // Họ và tên
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.font = { name: 'Calibri', size: 10, bold: true };
          break;
        case 4: // Lớp
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          break;
        case 5: // Điểm ban đầu
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          break;
        case 6: // Tổng điểm cộng
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF059669' } }; // Xanh lá
          break;
        case 7: // Tổng điểm trừ (hiển thị số dương)
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFE11D48' } }; // Đỏ hồng
          break;
        case 8: // Tổng điểm thi đua
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
          break;
        case 9: // Xếp loại thi đua
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = {
            name: 'Calibri',
            size: 10,
            bold: true,
            color: {
              argb:
                sum.rating === 'Tốt'
                  ? 'FF059669'
                  : sum.rating === 'Khá'
                  ? 'FF2563EB'
                  : sum.rating === 'Đạt'
                  ? 'FFD97706'
                  : 'FFE11D48',
            },
          };
          break;
        case 10: // Xếp hạng
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Calibri', size: 10, bold: true };
          if (sum.rank === 1) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Vàng nhạt top 1
          }
          break;
        case 11: // Số lượt tích cực
        case 12: // Số lượt vi phạm
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          break;
        case 13: // Ghi chú
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
          break;
      }
    });
  });

  // Hàng tổng kết / thống kê lớp
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

  // Độ rộng cột hợp lý, đủ rộng và không cắt chữ
  ws1.columns = [
    { width: 6 }, // STT
    { width: 18 }, // Mã hồ sơ
    { width: 24 }, // Họ và tên
    { width: 10 }, // Lớp
    { width: 14 }, // Điểm ban đầu
    { width: 15 }, // Tổng điểm cộng
    { width: 15 }, // Tổng điểm trừ
    { width: 18 }, // Tổng điểm thi đua
    { width: 16 }, // Xếp loại thi đua
    { width: 12 }, // Xếp hạng
    { width: 16 }, // Số lượt tích cực
    { width: 16 }, // Số lượt vi phạm
    { width: 26 }, // Ghi chú
  ];

  // ==========================================
  // SHEET 2: "Chi tiết ghi nhận"
  // ==========================================
  const ws2 = workbook.addWorksheet('Chi tiết ghi nhận', {
    views: [{ state: 'frozen', ySplit: 5 }], // Cố định hàng tiêu đề ở dòng 5
    properties: { defaultRowHeight: 22 },
  });

  // Hàng 1: Tên Trường
  ws2.mergeCells('A1:D1');
  const schoolCell2 = ws2.getCell('A1');
  schoolCell2.value = schoolName.toUpperCase();
  schoolCell2.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  schoolCell2.alignment = { vertical: 'middle', horizontal: 'left' };

  // Hàng 2: Tiêu đề Sheet 2
  ws2.mergeCells('A2:H2');
  const titleCell2 = ws2.getCell('A2');
  titleCell2.value = `NHẬT KÝ CHI TIẾT SỰ VIỆC THI ĐUA & NỀ NẾP - LỚP ${className.toUpperCase()}`;
  titleCell2.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FF0284C7' } }; // Xanh dương thanh lịch
  titleCell2.alignment = { vertical: 'middle', horizontal: 'center' };
  ws2.getRow(2).height = 30;

  // Hàng 3: Kỳ báo cáo & Thời gian xuất
  ws2.mergeCells('A3:H3');
  const metaCell2 = ws2.getCell('A3');
  metaCell2.value = `Kỳ báo cáo: ${periodInfo.label}  •  GVCN: ${teacherName}  •  Tổng cộng: ${periodRecords.length} lượt ghi nhận`;
  metaCell2.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
  metaCell2.alignment = { vertical: 'middle', horizontal: 'center' };

  // Hàng 4: Đệm
  ws2.getRow(4).height = 8;

  // Hàng 5: Tiêu đề cột
  const headers2 = [
    'Thời gian',
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
      fgColor: { argb: 'FF0369A1' }, // Xanh dương đậm
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF0C4A6E' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  });

  // Bật bộ lọc (AutoFilter) cho Sheet 2
  ws2.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5, column: headers2.length },
  };

  // Nạp dữ liệu sự việc
  let startRowIndex2 = 6;
  if (periodRecords.length === 0) {
    const emptyRow = ws2.getRow(startRowIndex2);
    ws2.mergeCells(`A${startRowIndex2}:H${startRowIndex2}`);
    emptyRow.getCell(1).value = 'Không có sự việc vi phạm hay khen thưởng nào được ghi nhận trong khoảng thời gian này.';
    emptyRow.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
    emptyRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    emptyRow.height = 36;
  } else {
    periodRecords.forEach((rec, idx) => {
      const row = ws2.getRow(startRowIndex2 + idx);
      row.height = 24;

      const isPositive = (rec.points || 0) > 0;
      const pointsFormatted = isPositive ? `+${rec.points}đ` : `${rec.points}đ`;
      const recordTypeStr = isPositive ? 'Tích cực' : 'Vi phạm';
      const authorStr = sanitizeStringForExcel(rec.note && rec.note.includes('GVCN') ? rec.note : teacherName);

      row.values = [
        formatViDate(rec.date), // Thời gian: DD/MM/YYYY
        rec.studentId, // Mã hồ sơ: text
        rec.studentName, // Họ và tên
        sanitizeStringForExcel(rec.ruleName), // Nội dung sự việc
        recordTypeStr, // Loại ghi nhận
        pointsFormatted, // Điểm cộng/trừ có dấu (+5đ, -2đ)
        authorStr, // Người ghi nhận
        sanitizeStringForExcel(rec.note || ''), // Ghi chú
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
            fgColor: { argb: 'FFF0F9FF' }, // Xanh nhạt xen kẽ
          };
        }

        switch (colNumber) {
          case 1: // Thời gian
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            break;
          case 2: // Mã hồ sơ
            cell.numFmt = '@';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            break;
          case 3: // Họ và tên
            cell.font = { name: 'Calibri', size: 10, bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            break;
          case 4: // Nội dung sự việc
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            break;
          case 5: // Loại ghi nhận
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = {
              name: 'Calibri',
              size: 10,
              bold: true,
              color: { argb: isPositive ? 'FF059669' : 'FFE11D48' },
            };
            break;
          case 6: // Điểm có dấu
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = {
              name: 'Calibri',
              size: 10,
              bold: true,
              color: { argb: isPositive ? 'FF059669' : 'FFE11D48' },
            };
            break;
          case 7: // Người ghi nhận
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            break;
          case 8: // Ghi chú
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            break;
        }
      });
    });
  }

  ws2.columns = [
    { width: 14 }, // Thời gian
    { width: 18 }, // Mã hồ sơ
    { width: 24 }, // Họ và tên
    { width: 34 }, // Nội dung sự việc
    { width: 16 }, // Loại ghi nhận
    { width: 16 }, // Điểm cộng/trừ có dấu
    { width: 22 }, // Người ghi nhận
    { width: 32 }, // Ghi chú
  ];

  // Định dạng tên file: Thi_dua_[TenLop]_[TuNgay]_[DenNgay].xlsx
  // Ngày được format dạng DD-MM-YYYY tránh dấu gạch chéo
  const cleanClassName = className.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fromDateClean = formatViDate(periodInfo.startDate).replace(/\//g, '-');
  const toDateClean = formatViDate(periodInfo.endDate).replace(/\//g, '-');
  const fileName = `Thi_dua_${cleanClassName}_${fromDateClean}_${toDateClean}.xlsx`;

  // Xuất binary buffer và tải về trên trình duyệt
  const buffer = await workbook.xlsx.writeBuffer();
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

  return {
    success: true,
    fileName,
    totalStudents: summaries.length,
    totalRecords: periodRecords.length,
  };
}

import ExcelJS from 'exceljs';
import { DisciplineRecord, Student } from '../types';
import { formatViDate } from './helpers';

export interface ExportStudentViolationParams {
  student: Student;
  className: string;
  schoolName: string;
  schoolYear: string;
  teacherName: string;
  selectedPeriod: string; // 'all' | 'year' | 'hk1' | 'hk2' | 'YYYY-MM'
  periodLabel: string;
  records: DisciplineRecord[]; // Only records for this student in this period
  basePoints: number;
  finalPoints: number;
  suggestedRating: string;
}

/**
 * Xuất file Excel (.xlsx) tổng hợp vi phạm thi đua và kỷ luật cho từng học sinh
 * Tuân thủ chuẩn định dạng giáo dục, có khung viền, màu sắc hài hòa và thông báo khi không có vi phạm
 */
export async function exportStudentViolationsToExcel({
  student,
  className,
  schoolName,
  schoolYear,
  teacherName,
  selectedPeriod,
  periodLabel,
  records,
  basePoints,
  finalPoints,
  suggestedRating,
}: ExportStudentViolationParams): Promise<{ success: boolean; fileName: string; totalViolations: number }> {
  // 1. Lọc các sự việc vi phạm (điểm trừ < 0)
  const violationRecords = records.filter((r) => (r.points || 0) < 0);
  
  // Sắp xếp sự việc vi phạm theo ngày tăng dần rồi giảm dần
  violationRecords.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const totalViolations = violationRecords.length;
  const totalDeductedPoints = violationRecords.reduce(
    (sum, r) => sum + Math.abs(r.points || 0),
    0
  );

  // 2. Tạo workbook và worksheet ExcelJS
  const workbook = new ExcelJS.Workbook();
  workbook.creator = teacherName || 'Giáo viên Chủ nhiệm';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Vi phạm kỷ luật', {
    views: [{ state: 'normal' }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.6,
        bottom: 0.6,
        header: 0.3,
        footer: 0.3,
      },
    },
  });

  // Độ rộng cột
  ws.columns = [
    { width: 7 }, // Col 1 (A): STT
    { width: 15 }, // Col 2 (B): Ngày xảy ra
    { width: 38 }, // Col 3 (C): Nội dung vi phạm
    { width: 14 }, // Col 4 (D): Điểm bị trừ
    { width: 32 }, // Col 5 (E): Ghi chú
  ];

  // ==========================================
  // KHỐI QUỐC HIỆU & THÔNG TIN TRƯỜNG
  // ==========================================
  const schoolRow = ws.getRow(1);
  schoolRow.getCell(1).value = (schoolName || 'TRƯỜNG THCS NGUYỄN HUỆ').toUpperCase();
  schoolRow.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };

  schoolRow.getCell(4).value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
  schoolRow.getCell(4).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
  schoolRow.getCell(4).alignment = { horizontal: 'center' };
  ws.mergeCells('D1:E1');

  const classInfoRow = ws.getRow(2);
  classInfoRow.getCell(1).value = `LỚP: ${className.toUpperCase()} • NĂM HỌC: ${schoolYear}`;
  classInfoRow.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };

  classInfoRow.getCell(4).value = 'Độc lập - Tự do - Hạnh phúc';
  classInfoRow.getCell(4).font = { name: 'Calibri', size: 10, italic: true, bold: true, color: { argb: 'FF1E293B' } };
  classInfoRow.getCell(4).alignment = { horizontal: 'center' };
  ws.mergeCells('D2:E2');

  // ==========================================
  // TIÊU ĐỀ BẢNG TỔNG HỢP
  // ==========================================
  ws.addRow([]); // Dòng 3 trống

  const titleRow = ws.getRow(4);
  titleRow.height = 30;
  titleRow.getCell(1).value = 'BẢNG TỔNG HỢP VI PHẠM THI ĐUA VÀ KỶ LUẬT HỌC SINH';
  titleRow.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E293B' } };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  titleRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFDF2F8' }, // Hồng phấn nhạt nhận diện 6A8
  };
  ws.mergeCells('A4:E4');

  const periodRow = ws.getRow(5);
  periodRow.height = 20;
  periodRow.getCell(1).value = `Kỳ đánh giá: ${periodLabel.toUpperCase()}`;
  periodRow.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
  periodRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  ws.mergeCells('A5:E5');

  ws.addRow([]); // Dòng 6 trống

  // ==========================================
  // KHỐI THÔNG TIN HỌC SINH
  // ==========================================
  const infoRow1 = ws.getRow(7);
  infoRow1.getCell(1).value = 'Họ và tên học sinh:';
  infoRow1.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
  infoRow1.getCell(2).value = student.name.toUpperCase();
  infoRow1.getCell(2).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  ws.mergeCells('B7:C7');

  infoRow1.getCell(4).value = 'Mã học sinh:';
  infoRow1.getCell(4).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
  infoRow1.getCell(5).value = student.id;
  infoRow1.getCell(5).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
  infoRow1.getCell(5).numFmt = '@';

  const infoRow2 = ws.getRow(8);
  infoRow2.getCell(1).value = 'Lớp:';
  infoRow2.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
  infoRow2.getCell(2).value = className;
  infoRow2.getCell(2).font = { name: 'Calibri', size: 10, bold: true };
  ws.mergeCells('B8:C8');

  infoRow2.getCell(4).value = 'Giáo viên chủ nhiệm:';
  infoRow2.getCell(4).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
  infoRow2.getCell(5).value = teacherName || 'Cô Lê Thị Kim Thanh';
  infoRow2.getCell(5).font = { name: 'Calibri', size: 10, bold: true };

  const infoRow3 = ws.getRow(9);
  infoRow3.getCell(1).value = 'Điểm chuẩn kỳ:';
  infoRow3.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
  infoRow3.getCell(2).value = `${basePoints} điểm`;
  infoRow3.getCell(2).font = { name: 'Calibri', size: 10, bold: true };
  ws.mergeCells('B9:C9');

  infoRow3.getCell(4).value = 'Điểm thi đua còn lại:';
  infoRow3.getCell(4).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
  infoRow3.getCell(5).value = `${finalPoints} điểm (${suggestedRating})`;
  infoRow3.getCell(5).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF059669' } };

  // Khung viền cho khối thông tin
  [7, 8, 9].forEach((r) => {
    const row = ws.getRow(r);
    row.height = 20;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  ws.addRow([]); // Dòng 10 trống

  // ==========================================
  // BẢNG CHI TIẾT SỰ VIỆC VI PHẠM
  // ==========================================
  const headerRow = ws.getRow(11);
  headerRow.height = 26;
  const headers = ['STT', 'Ngày xảy ra', 'Nội dung vi phạm', 'Điểm bị trừ', 'Ghi chú / Chi tiết sự việc'];
  headerRow.values = headers;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEDB5C1' }, // Màu hồng pastel #EDB5C1
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  });

  let currentRowIdx = 12;

  if (totalViolations === 0) {
    // Trường hợp học sinh không có vi phạm trong kỳ
    const emptyRow = ws.getRow(currentRowIdx);
    emptyRow.height = 36;
    emptyRow.getCell(1).value = 'Không có sự việc vi phạm trong kỳ đánh giá';
    emptyRow.getCell(1).font = { name: 'Calibri', size: 11, bold: true, italic: true, color: { argb: 'FF059669' } };
    emptyRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    ws.mergeCells(`A${currentRowIdx}:E${currentRowIdx}`);

    emptyRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0FDF4' }, // Xanh lá pastel nhạt
      };
    });
    currentRowIdx++;
  } else {
    // Có sự việc vi phạm: Nạp từng dòng
    violationRecords.forEach((rec, idx) => {
      const row = ws.getRow(currentRowIdx);
      row.height = 24;

      const penaltyScore = rec.points < 0 ? rec.points : -rec.points;

      row.values = [
        idx + 1, // STT
        formatViDate(rec.date), // Ngày xảy ra
        rec.ruleName, // Nội dung vi phạm
        penaltyScore, // Điểm bị trừ (hiển thị số âm)
        rec.note || '', // Ghi chú
      ];

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        // Xen kẽ dòng
        if (idx % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFDF2F8' },
          };
        }

        switch (colNumber) {
          case 1: // STT
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            break;
          case 2: // Ngày
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            break;
          case 3: // Nội dung vi phạm
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
            break;
          case 4: // Điểm bị trừ
            cell.numFmt = '#,##0;[Red]-#,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFE11D48' } };
            break;
          case 5: // Ghi chú
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF475569' } };
            break;
        }
      });

      currentRowIdx++;
    });
  }

  // ==========================================
  // HÀNG TỔNG CỘNG CUỐI BẢNG
  // ==========================================
  const summaryRow = ws.getRow(currentRowIdx);
  summaryRow.height = 26;

  summaryRow.getCell(1).value = `TỔNG CỘNG (${totalViolations} LẦN VI PHẠM)`;
  summaryRow.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
  summaryRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  ws.mergeCells(`A${currentRowIdx}:C${currentRowIdx}`);

  summaryRow.getCell(4).value = totalDeductedPoints > 0 ? -totalDeductedPoints : 0;
  summaryRow.getCell(4).numFmt = '#,##0;[Red]-#,##0';
  summaryRow.getCell(4).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFE11D48' } };
  summaryRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

  summaryRow.getCell(5).value = `Điểm thi đua còn lại: ${finalPoints}đ`;
  summaryRow.getCell(5).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  summaryRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'left' };

  summaryRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF475569' } },
      bottom: { style: 'double', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
  });

  // ==========================================
  // CHỮ KÝ XÁC NHẬN PHÍA DƯỚI
  // ==========================================
  const signDateRowIdx = currentRowIdx + 2;
  const signRow = ws.getRow(signDateRowIdx);
  const now = new Date();
  signRow.getCell(4).value = `..., ngày ${String(now.getDate()).padStart(2, '0')} tháng ${String(now.getMonth() + 1).padStart(2, '0')} năm ${now.getFullYear()}`;
  signRow.getCell(4).font = { name: 'Calibri', size: 10, italic: true };
  signRow.getCell(4).alignment = { horizontal: 'center' };
  ws.mergeCells(`D${signDateRowIdx}:E${signDateRowIdx}`);

  const titleSignRowIdx = signDateRowIdx + 1;
  const titleSignRow = ws.getRow(titleSignRowIdx);
  titleSignRow.getCell(1).value = 'NGƯỜI LẬP BẢNG';
  titleSignRow.getCell(1).font = { name: 'Calibri', size: 10, bold: true };
  titleSignRow.getCell(1).alignment = { horizontal: 'center' };
  ws.mergeCells(`A${titleSignRowIdx}:B${titleSignRowIdx}`);

  titleSignRow.getCell(4).value = 'GIÁO VIÊN CHỦ NHIỆM';
  titleSignRow.getCell(4).font = { name: 'Calibri', size: 10, bold: true };
  titleSignRow.getCell(4).alignment = { horizontal: 'center' };
  ws.mergeCells(`D${titleSignRowIdx}:E${titleSignRowIdx}`);

  const nameSignRowIdx = titleSignRowIdx + 4;
  const nameSignRow = ws.getRow(nameSignRowIdx);
  nameSignRow.getCell(4).value = teacherName || 'Cô Lê Thị Kim Thanh';
  nameSignRow.getCell(4).font = { name: 'Calibri', size: 10, bold: true };
  nameSignRow.getCell(4).alignment = { horizontal: 'center' };
  ws.mergeCells(`D${nameSignRowIdx}:E${nameSignRowIdx}`);

  // ==========================================
  // TẠO FILE VÀ TẢI VỀ TRÊN TRÌNH DUYỆT
  // ==========================================
  // Tên tệp: ViPham_Lop6A8_HoTenHocSinh_ThangNam.xlsx
  const cleanName = student.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]/g, '');

  const cleanClass = className.replace(/[^a-zA-Z0-9]/g, '');

  let periodClean = 'TatCa';
  if (selectedPeriod.startsWith('20')) {
    const parts = selectedPeriod.split('-');
    periodClean = `Thang${parts[1]}_${parts[0]}`;
  } else if (selectedPeriod === 'hk1') {
    periodClean = 'HocKy1';
  } else if (selectedPeriod === 'hk2') {
    periodClean = 'HocKy2';
  } else if (selectedPeriod === 'year') {
    periodClean = 'CaNam';
  }

  const fileName = `ViPham_Lop${cleanClass}_${cleanName}_${periodClean}.xlsx`;

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
    totalViolations,
  };
}

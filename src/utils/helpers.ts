import { AttendanceStatus, DisciplineRecord, Student } from '../types';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export function getTodayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatViDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export const STATUS_META: Record<
  AttendanceStatus,
  { label: string; short: string; badgeClass: string; bgClass: string; textClass: string }
> = {
  c: {
    label: 'Có mặt',
    short: 'C',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    bgClass: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    textClass: 'text-emerald-700',
  },
  v: {
    label: 'Vắng có phép',
    short: 'P',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    bgClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    textClass: 'text-amber-700',
  },
  m: {
    label: 'Đi muộn',
    short: 'M',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    bgClass: 'bg-blue-500 hover:bg-blue-600 text-white',
    textClass: 'text-blue-700',
  },
  kp: {
    label: 'Vắng không phép',
    short: 'KP',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    bgClass: 'bg-rose-500 hover:bg-rose-600 text-white',
    textClass: 'text-rose-700',
  },
};

export const SUBJECT_LIST = [
  'Toán',
  'Ngữ văn',
  'Tiếng Anh',
  'Khoa học tự nhiên',
  'Lịch sử & Địa lý',
  'Giáo dục công dân',
  'Tin học',
  'Công nghệ',
  'Giáo dục thể chất',
  'Nghệ thuật',
];

export function calculateAverageGrade(grades?: Record<string, number>): number | null {
  if (!grades) return null;
  const values = Object.values(grades).filter((v) => typeof v === 'number' && !isNaN(v));
  if (values.length === 0) return null;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

export function getConductFromGrade(avg: number | null): string {
  if (avg === null) return 'Chưa xếp loại';
  if (avg >= 8.0) return 'Tốt';
  if (avg >= 6.5) return 'Khá';
  if (avg >= 5.0) return 'Đạt';
  return 'Chưa đạt';
}

export function calculateTotalPoints(records: DisciplineRecord[], studentId: string): number {
  return records
    .filter((r) => r.studentId === studentId)
    .reduce((sum, r) => sum + (r.points || 0), 100); // 100 điểm nề nếp ban đầu chuẩn
}

export function exportStudentsToCsv(students: Student[]): string {
  const header = ['STT', 'Mã định danh', 'Họ và tên', 'Ngày sinh', 'Giới tính', 'Chức vụ', 'SĐT Phụ huynh', 'Họ tên Phụ huynh', 'Địa chỉ'];
  const rows = students.map((s, index) => [
    index + 1,
    s.id,
    `"${s.name.replace(/"/g, '""')}"`,
    s.dob,
    s.gender,
    `"${(s.position || 'Học sinh').replace(/"/g, '""')}"`,
    s.parentPhone || '',
    `"${(s.parentName || '').replace(/"/g, '""')}"`,
    `"${(s.address || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = '\uFEFF' + [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  return csvContent;
}

export function parseCsvStudents(text: string): Partial<Student>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length <= 1) return [];

  // Determine delimiter
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';

  const results: Partial<Student>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    // Simple split respecting basic quotes
    const cols = splitRespectingQuotes(rawLine, delimiter);
    if (cols.length < 2) continue;

    // Check if col[0] is index STT or ID or Name
    let id = '';
    let name = '';
    let dob = '2012-01-01';
    let gender: 'Nam' | 'Nữ' = 'Nam';
    let position = 'Học sinh';
    let parentPhone = '';
    let parentName = '';
    let address = '';

    // If col 0 looks like number index (1, 2, 3...)
    const isFirstColIndex = /^\d+$/.test(cols[0].trim()) && cols[0].trim().length < 4;
    const offset = isFirstColIndex ? 1 : 0;

    if (cols.length > offset) {
      const candidateId = cols[offset].trim();
      if (candidateId && !candidateId.includes(' ')) {
        id = candidateId;
        name = cols[offset + 1]?.trim() || '';
        dob = cols[offset + 2]?.trim() || '2012-01-01';
        gender = cols[offset + 3]?.toLowerCase().includes('nữ') ? 'Nữ' : 'Nam';
        position = cols[offset + 4]?.trim() || 'Học sinh';
        parentPhone = cols[offset + 5]?.trim() || '';
        parentName = cols[offset + 6]?.trim() || '';
        address = cols[offset + 7]?.trim() || '';
      } else {
        name = candidateId;
        id = generateId();
        dob = cols[offset + 1]?.trim() || '2012-01-01';
        gender = cols[offset + 2]?.toLowerCase().includes('nữ') ? 'Nữ' : 'Nam';
        position = cols[offset + 3]?.trim() || 'Học sinh';
        parentPhone = cols[offset + 4]?.trim() || '';
        parentName = cols[offset + 5]?.trim() || '';
        address = cols[offset + 6]?.trim() || '';
      }
    }

    if (name) {
      results.push({
        id: id || generateId(),
        name,
        dob,
        gender,
        position: position || 'Học sinh',
        parentPhone,
        parentName,
        address,
        conduct: 'Tốt',
        password: formatViDate(dob) || dob,
      });
    }
  }

  return results;
}

export function normalizeDateDigits(dateStr: string): string {
  return (dateStr || '').replace(/\D/g, '');
}

/**
 * Tìm học sinh theo ngày sinh (DD/MM/YYYY, DDMMYYYY, YYYY-MM-DD), mã ID hoặc Họ tên
 */
export function findStudentsByAccountOrDob(query: string, students: Student[]): Student[] {
  const trimmed = (query || '').trim().toLowerCase();
  if (!trimmed) return [];

  const queryDigits = normalizeDateDigits(trimmed);

  return students.filter((s) => {
    // 1. So khớp ID chính xác
    if (s.id.toLowerCase() === trimmed) return true;

    // 2. So khớp ngày sinh dạng chuỗi hoặc số
    if (s.dob) {
      const formattedVi = formatViDate(s.dob).toLowerCase();
      if (s.dob.toLowerCase() === trimmed || formattedVi === trimmed) return true;

      if (queryDigits.length >= 6) {
        const dobDigits = normalizeDateDigits(s.dob);
        const dobViDigits = normalizeDateDigits(formattedVi);
        if (queryDigits === dobDigits || queryDigits === dobViDigits) return true;
      }
    }

    // 3. So khớp họ tên
    if (s.name.toLowerCase().includes(trimmed)) return true;

    return false;
  });
}

export function extractDobDigitsFromStudent(student: Student): string {
  if (!student.dob) return '';
  const str = student.dob.trim();
  let day = '';
  let month = '';
  let year = '';

  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        year = parts[0];
        month = parts[1].padStart(2, '0');
        day = parts[2].padStart(2, '0');
      } else {
        // DD-MM-YYYY
        day = parts[0].padStart(2, '0');
        month = parts[1].padStart(2, '0');
        year = parts[2];
      }
    }
  } else if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      day = parts[0].padStart(2, '0');
      month = parts[1].padStart(2, '0');
      year = parts[2];
    }
  } else {
    const digits = str.replace(/\D/g, '');
    if (digits.length === 8) {
      day = digits.substring(0, 2);
      month = digits.substring(2, 4);
      year = digits.substring(4, 8);
    }
  }

  if (day && month && year) {
    return `${day}${month}${year}`;
  }
  return str.replace(/\D/g, '');
}

export interface StudentAuthResult {
  success: boolean;
  student?: Student;
  errorMessage?: string;
  isAmbiguous?: boolean;
}

/**
 * Lấy mã số thứ tự học sinh gồm 2 chữ số (01, 02, 03, ..., 40)
 * Mã số học sinh là mã ổn định của từng em trong lớp, không phụ thuộc vào thứ tự lọc/sắp xếp bảng.
 */
export function getStudentTwoDigitCode(student: Student, allStudents?: Student[]): string | null {
  if (!student) return null;
  const rawId = (student.id || '').trim();

  // 1. Nếu id là 2 chữ số (ví dụ: "01", "15")
  if (/^\d{2}$/.test(rawId)) {
    return rawId;
  }

  // 2. Nếu id là 1 chữ số (ví dụ: "1", "9") -> thêm số 0 ở đầu: "01", "09"
  if (/^\d{1}$/.test(rawId)) {
    return rawId.padStart(2, '0');
  }

  // 3. Nếu id có tiền tố như HS01, MS01, S01, HS15
  const prefixMatch = rawId.match(/^(?:HS|MS|S)?0*(\d{1,2})$/i);
  if (prefixMatch && prefixMatch[1]) {
    return prefixMatch[1].padStart(2, '0');
  }

  // 4. Nếu id kết thúc bằng 1 hoặc 2 chữ số (ví dụ: "HS-01", "HS_15")
  const digitsMatch = rawId.match(/(\d{1,2})$/);
  if (digitsMatch && digitsMatch[1]) {
    return digitsMatch[1].padStart(2, '0');
  }

  // 5. Nếu có danh sách lớp gốc (unfiltered canonical list) và student có vị trí cố định
  if (allStudents && Array.isArray(allStudents)) {
    const idx = allStudents.findIndex((s) => s.id === student.id);
    if (idx !== -1 && idx < 99) {
      return String(idx + 1).padStart(2, '0');
    }
  }

  return null;
}

/**
 * Xác thực đăng nhập học sinh theo quy tắc 10 chữ số MMDDMMYYYY:
 * - 2 chữ số đầu (MM): Mã số thứ tự học sinh (01, 02, 03, ..., 15, ...)
 * - 2 chữ số tiếp theo (DD): Ngày sinh (01 - 31)
 * - 2 chữ số tiếp theo (MM): Tháng sinh (01 - 12)
 * - 4 chữ số cuối (YYYY): Năm sinh đầy đủ
 * Ví dụ: Mã 01 sinh ngày 30/11/2015 -> Mật khẩu: 0130112015
 */
export function authenticateStudentByPassword(
  rawInput: string,
  students: Student[]
): StudentAuthResult {
  const trimmed = (rawInput || '').trim();

  if (!trimmed) {
    return {
      success: false,
      errorMessage: 'Vui lòng nhập mật khẩu học sinh gồm 10 chữ số.',
    };
  }

  // Kiểm tra không chứa ký tự chữ cái hay tiền tố MS
  if (!/^\d+$/.test(trimmed)) {
    return {
      success: false,
      errorMessage:
        'Mật khẩu chỉ bao gồm 10 chữ số (2 số mã HS + 8 số ngày sinh). Không chứa ký tự chữ cái hay tiền tố MS.',
    };
  }

  // Kiểm tra độ dài đúng 10 chữ số
  if (trimmed.length !== 10) {
    return {
      success: false,
      errorMessage:
        'Mật khẩu phải gồm đúng 10 chữ số: 2 số mã HS + 2 số ngày + 2 số tháng + 4 số năm sinh (Ví dụ: 0130112015).',
    };
  }

  // 1. Tách 2 chữ số đầu làm mã số học sinh và 8 chữ số ngày sinh
  const studentCode = trimmed.substring(0, 2);
  const enteredDob = trimmed.substring(2);

  // 2. Tìm học sinh theo mã số 2 chữ số trong danh sách lớp
  const matchingStudents = students.filter((s) => {
    const code = getStudentTwoDigitCode(s, students);
    return code === studentCode;
  });

  // Báo nếu có mã trùng trong danh sách lớp
  if (matchingStudents.length > 1) {
    return {
      success: false,
      isAmbiguous: true,
      errorMessage: `Phát hiện có ${matchingStudents.length} học sinh trùng mã số ${studentCode} trong danh sách lớp. Vui lòng báo Giáo viên chủ nhiệm kiểm tra lại mã số.`,
    };
  }

  // Không tìm thấy học sinh có mã số tương ứng
  if (matchingStudents.length === 0) {
    return {
      success: false,
      errorMessage: 'Thông tin đăng nhập không chính xác',
    };
  }

  const targetStudent = matchingStudents[0];

  // 3. Đối chiếu với ngày, tháng, năm sinh đã lưu của học sinh đó
  const targetDobDigits = extractDobDigitsFromStudent(targetStudent);

  if (enteredDob === targetDobDigits) {
    return {
      success: true,
      student: targetStudent,
    };
  }

  // Kiểm tra nếu giáo viên đã gán mật khẩu riêng đặc biệt đúng bằng chuỗi 10 số này
  if (targetStudent.password && targetStudent.password.trim() === trimmed) {
    return {
      success: true,
      student: targetStudent,
    };
  }

  // Từ chối đăng nhập và hiển thị thông báo chung an toàn, không tiết lộ ngày sinh
  return {
    success: false,
    errorMessage: 'Thông tin đăng nhập không chính xác',
  };
}

export function checkStudentPassword(inputPass: string, student: Student): boolean {
  const trimmed = (inputPass || '').trim();
  if (!trimmed) {
    return true;
  }
  // 1. Direct match with student.password
  if (student.password && trimmed === student.password.trim()) {
    return true;
  }
  // 2. Direct match with dob (formatted DD/MM/YYYY or raw)
  if (student.dob) {
    const formattedVi = formatViDate(student.dob);
    if (trimmed === student.dob || trimmed === formattedVi) {
      return true;
    }
    // 3. Digit-only match: e.g. '24092013' or '20130924'
    const inputDigits = normalizeDateDigits(trimmed);
    const dobViDigits = normalizeDateDigits(formattedVi);
    const dobRawDigits = normalizeDateDigits(student.dob);
    if (inputDigits && (inputDigits === dobViDigits || inputDigits === dobRawDigits)) {
      return true;
    }
  }
  // 4. Fallback 123
  if (trimmed === '123') {
    return true;
  }
  return false;
}

function splitRespectingQuotes(row: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

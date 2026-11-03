export type UserRole = 'teacher' | 'student';

export type AttendanceStatus = 'c' | 'v' | 'm' | 'kp';
// 'c': Có mặt (Present)
// 'v': Vắng có phép (Excused absence)
// 'm': Đi muộn (Late)
// 'kp': Vắng không phép (Unexcused absence)

export type ConductGrade = 'Tốt' | 'Khá' | 'Đạt' | 'Chưa đạt';

export interface OfficialConductEvaluation {
  rating: ConductGrade;
  reason?: string;
  confirmedBy: string;
  confirmedAt: string; // YYYY-MM-DD HH:mm
}

export interface Student {
  id: string;
  name: string;
  dob: string;
  gender: 'Nam' | 'Nữ';
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  address?: string;
  avatar?: string;
  position?: string; // Lớp trưởng, Lớp phó, Tổ trưởng, etc.
  password?: string;
  grades?: Record<string, number>;
  conduct?: string; // Tốt, Khá, Đạt, Chưa đạt
  notes?: string;
  officialConduct?: OfficialConductEvaluation;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
}

export interface DisciplineRecord {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  ruleName: string;
  points: number; // positive for praise, negative for violation
  note?: string;
  type: 'plus' | 'minus';
  author?: string;
}

export interface DisciplineRule {
  id: string;
  name: string;
  points: number; // positive for praise, negative for violation
  type: 'plus' | 'minus';
  description?: string;
}

export interface NoteRecord {
  id: string;
  studentId: string;
  date: string;
  title: string;
  content: string;
  author: string;
}

export interface NoticeVideo {
  id: string;
  url: string;
  title?: string;
  type?: 'youtube' | 'upload';
}

export interface NoticeLink {
  id: string;
  title: string;
  url: string;
  description?: string;
}

export interface BoardNotice {
  id: string;
  title: string;
  content: string;
  date: string;
  priority: 'high' | 'normal' | 'info';
  pinned: boolean;
  author?: string;
  category?: string; // 'Thông báo' | 'Khen thưởng' | 'Kế hoạch' | 'Nhắc nhở' | 'Khẩn'
  images?: string[];
  videos?: NoticeVideo[];
  links?: NoticeLink[];
  updatedAt?: string;
}

export interface ClassConfig {
  appName: string;
  schoolName: string;
  className: string;
  schoolYear: string;
  teacherName: string;
  teacherPassword: string;
  classAvatar?: string;
  availableClasses?: string[];
}

export type EmulationPeriodType = 'week' | 'month' | 'semester' | 'year';

export interface ConductTierConfig {
  id: 'tot' | 'kha' | 'dat' | 'chuadat';
  label: ConductGrade;
  minScore: number; // Điểm tối thiểu (>= minScore)
  description: string; // Mô tả tham khảo tiêu chuẩn rèn luyện do giáo viên tự nhập
  // Điều kiện bổ sung tự động (chỉ áp dụng khi giáo viên chủ động cấu hình)
  additionalRulesEnabled?: boolean;
  maxViolations?: number; // Số lần vi phạm tối đa cho phép trong kỳ
  downgradeTo?: ConductGrade; // Nếu vi phạm điều kiện bổ sung thì hạ xuống mức nào
}

export interface EmulationConfig {
  // Thang điểm thi đua
  initialPoints: number; // Điểm khởi đầu của mỗi học sinh trong một kỳ (mặc định 100)
  periodType: EmulationPeriodType; // Kỳ tính điểm mặc định: tuần, tháng, học kỳ hoặc năm học
  
  // Giới hạn điểm
  enableMinScore: boolean; // Bật/tắt điểm tối thiểu
  minScore: number; // Điểm tối thiểu (ví dụ 0)
  enableMaxScore: boolean; // Bật/tắt điểm tối đa
  maxScore: number; // Điểm tối đa (ví dụ 100 hoặc 120)

  // Quy tắc tổng hợp học kỳ / cả năm (không tự cộng dồn điểm khởi đầu các tháng một cách tùy tiện)
  aggregationMethod: 'single_initial' | 'monthly_average' | 'monthly_cumulative';
  // 'single_initial': Điểm khởi đầu 1 lần cho cả kỳ + Tổng điểm cộng toàn kỳ - Tổng điểm trừ toàn kỳ
  // 'monthly_average': Điểm trung bình cộng thi đua của các tháng trong kỳ
  // 'monthly_cumulative': Điểm khởi đầu mỗi tháng cộng dồn (Tổng điểm tích lũy)

  // Tiêu chí xếp loại (4 mức: Tốt, Khá, Đạt, Chưa đạt)
  conductTiers: ConductTierConfig[];

  // Quản lý phiên bản & thời điểm áp dụng
  version: number;
  updatedAt: string; // ISO string thời điểm cập nhật
  appliedAt: string; // Ngày/tháng bắt đầu áp dụng (YYYY-MM-DD hoặc chuỗi)
}

export interface AppState {
  config: ClassConfig;
  students: Student[];
  attendance: AttendanceRecord[];
  discipline: DisciplineRecord[];
  notes: NoteRecord[];
  boardNotices: BoardNotice[];
  seatingChart?: Record<string, string>;
  disciplineRules?: DisciplineRule[];
  emulationConfig?: EmulationConfig;
  classEmulationConfigs?: Record<string, EmulationConfig>; // Tách riêng theo lớp và năm học: key = `${className}_${schoolYear}`
}

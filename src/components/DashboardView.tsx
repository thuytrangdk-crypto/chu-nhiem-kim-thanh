import React, { useMemo } from 'react';
import { AppState, AttendanceStatus, Student } from '../types';
import {
  Users,
  CalendarCheck,
  Award,
  Bell,
  Sparkles,
  ArrowRight,
  TrendingUp,
  UserCheck,
  UserX,
  Clock,
  ShieldAlert,
  ChevronRight,
  GraduationCap,
  Star,
  PlusCircle,
  FileSpreadsheet,
  Megaphone,
  Edit2,
  Trophy,
} from 'lucide-react';
import { calculateAverageGrade, getTodayStr } from '../utils/helpers';

interface DashboardViewProps {
  state: AppState;
  isTeacher: boolean;
  currentStudentId: string | null;
  onSelectStudent: (id: string) => void;
  onNavigate: (view: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
  onOpenQuickEditSchool?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  state,
  isTeacher,
  currentStudentId,
  onSelectStudent,
  onNavigate,
  onShowToast,
  onOpenQuickEditSchool,
}) => {
  const today = getTodayStr();
  const students = state.students;

  // Counts
  const totalStudents = students.length;
  const maleCount = students.filter((s) => s.gender === 'Nam').length;
  const femaleCount = students.filter((s) => s.gender === 'Nữ').length;

  // Today attendance
  const todayRecords = state.attendance.filter((a) => a.date === today);
  const presentCount = todayRecords.filter((a) => a.status === 'c').length;
  const lateCount = todayRecords.filter((a) => a.status === 'm').length;
  const excusedCount = todayRecords.filter((a) => a.status === 'v').length;
  const unexcusedCount = todayRecords.filter((a) => a.status === 'kp').length;
  const markedCount = todayRecords.length;

  // Class leaders
  const classLeaders = students.filter(
    (s) =>
      s.position &&
      s.position !== 'Học sinh' &&
      (s.position.includes('trưởng') ||
        s.position.includes('phó') ||
        s.position.includes('thư') ||
        s.position.includes('Tổ trưởng'))
  );

  // TOP 5 HỌC TẬP: Chỉ dựa trên điểm học tập thực tế (ĐTB)
  const topAcademicStudents = useMemo(() => {
    // 1. Chỉ lấy học sinh có điểm học tập hợp lệ (không coi chưa nhập là 0)
    const validStudents = students
      .map((s) => {
        const avg = calculateAverageGrade(s.grades);
        return {
          student: s,
          avgGrade: avg,
        };
      })
      .filter((item): item is { student: Student; avgGrade: number } => item.avgGrade !== null);

    // 2. Sắp xếp giảm dần theo điểm ĐTB; nếu bằng điểm thì dùng mã hồ sơ (ID) để sắp thứ tự ổn định
    validStudents.sort((a, b) => {
      if (b.avgGrade !== a.avgGrade) {
        return b.avgGrade - a.avgGrade;
      }
      return a.student.id.localeCompare(b.student.id);
    });

    // 3. Lấy tối đa 5 học sinh
    const top5 = validStudents.slice(0, 5);

    // 4. Gán thứ hạng: nếu bằng điểm, cùng hạng!
    let currentRank = 1;
    return top5.map((item, index) => {
      if (index > 0 && item.avgGrade < top5[index - 1].avgGrade) {
        currentRank = index + 1;
      }
      return {
        ...item,
        rank: currentRank,
      };
    });
  }, [students]);

  // Latest notices
  const recentNotices = [...state.boardNotices].slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Welcome Banner - Màu nền hồng pastel #EDB5C1 thanh lịch */}
      <div className="relative overflow-hidden bg-linear-to-r from-[#FCF4F6] via-[#FAF0F3] to-[#F8E2E7] rounded-3xl p-6 lg:p-8 text-gray-900 border border-[#E5B2BD] shadow-sm">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-[#EDB5C1]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-48 h-48 bg-[#EDB5C1]/15 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/95 backdrop-blur-md text-xs font-semibold text-[#1E293B] border border-[#EDB5C1] shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Năm học {state.config.schoolYear} • {state.config.schoolName || 'Trường THCS Chu Văn An'}</span>
              </div>

              {/* Sửa thông tin linh động bên ngoài */}
              {isTeacher && onOpenQuickEditSchool && (
                <button
                  type="button"
                  onClick={onOpenQuickEditSchool}
                  className="px-2.5 py-1 rounded-full bg-white/90 hover:bg-white text-[#1E293B] text-xs font-bold transition-all border border-[#EDB5C1] flex items-center gap-1 active:scale-95 cursor-pointer shadow-2xs"
                  title="Chỉnh sửa linh động tên trường, lớp, năm học"
                >
                  <Edit2 className="w-3 h-3 text-[#1E293B]" />
                  <span>Sửa trường & năm học</span>
                </button>
              )}
            </div>
            <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-[#1E293B]">
              Chào mừng đến Lớp {state.config.className}!
            </h2>
            <p className="text-sm text-slate-700 max-w-xl font-medium">
              {isTeacher
                ? `Giáo viên chủ nhiệm: ${state.config.teacherName.startsWith('Cô ') || state.config.teacherName.startsWith('Thầy ') ? state.config.teacherName : `Cô ${state.config.teacherName}`}. Chúc cô và các con một ngày học tập sôi nổi và đạt nhiều kết quả tốt.`
                : `Học sinh: ${students.find((s) => s.id === currentStudentId)?.name || 'Học sinh'}. Chúc em học tập thật tốt hôm nay!`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isTeacher && (
              <>
                <button
                  onClick={() => onNavigate('attendance')}
                  className="px-4 py-2.5 bg-[#EDB5C1] hover:bg-[#E4A7B4] text-[#1E293B] font-black text-xs lg:text-sm rounded-xl shadow-md shadow-[#EDB5C1]/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <CalendarCheck className="w-4 h-4 text-[#1E293B]" />
                  <span>Điểm danh ngay</span>
                </button>
                <button
                  onClick={() => onNavigate('students')}
                  className="px-4 py-2.5 bg-white hover:bg-[#FCF4F6] text-[#1E293B] font-bold text-xs lg:text-sm rounded-xl border border-[#EDB5C1] shadow-xs active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Users className="w-4 h-4 text-[#1E293B]" />
                  <span>Quản lý học sinh</span>
                </button>
              </>
            )}
            <button
              onClick={() => onNavigate('board')}
              className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs lg:text-sm rounded-xl border border-gray-200 shadow-xs active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Megaphone className="w-4 h-4 text-gray-500" />
              <span>Xem bảng tin & sơ đồ</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total students */}
        <div
          onClick={() => onNavigate('students')}
          className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-indigo-600 flex items-center gap-0.5">
              <span>Chi tiết</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-gray-900">{totalStudents}</div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-0.5">
              Sĩ số học sinh
            </div>
            <div className="mt-2 text-xs text-gray-500 flex items-center gap-3">
              <span>Nam: <strong className="text-gray-800">{maleCount}</strong></span>
              <span>•</span>
              <span>Nữ: <strong className="text-gray-800">{femaleCount}</strong></span>
            </div>
          </div>
        </div>

        {/* Present Today */}
        <div
          onClick={() => onNavigate('attendance')}
          className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <UserCheck className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5">
              <span>Chuyên cần</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-gray-900">
              {presentCount} / {totalStudents}
            </div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-0.5">
              Có mặt hôm nay
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {markedCount === 0
                ? 'Chưa thực hiện điểm danh hôm nay'
                : `Tỷ lệ chuyên cần: ${Math.round((presentCount / (totalStudents || 1)) * 100)}%`}
            </div>
          </div>
        </div>

        {/* Late / Absent Today */}
        <div
          onClick={() => onNavigate('attendance')}
          className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:border-amber-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-amber-600 flex items-center gap-0.5">
              <span>Kiểm diện</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-gray-900">
              {lateCount + excusedCount + unexcusedCount}
            </div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-0.5">
              Vắng & Đi muộn
            </div>
            <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
              <span>Phép: <strong className="text-amber-700">{excusedCount}</strong></span>
              <span>•</span>
              <span>Muộn: <strong className="text-blue-700">{lateCount}</strong></span>
              <span>•</span>
              <span>K.Phép: <strong className="text-rose-700">{unexcusedCount}</strong></span>
            </div>
          </div>
        </div>

        {/* Thi đua / Notices */}
        <div
          onClick={() => onNavigate('board')}
          className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:border-violet-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Award className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-violet-600 flex items-center gap-0.5">
              <span>Bảng tin</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-gray-900">
              {state.boardNotices.length}
            </div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-0.5">
              Thông báo lớp học
            </div>
            <div className="mt-2 text-xs text-violet-600 font-medium truncate">
              {state.boardNotices.find((b) => b.pinned)?.title || 'Không có thông báo ghim'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Class Officers & Honor Roll */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ban Cán Sự Lớp */}
        <div className="bg-white rounded-3xl p-5 lg:p-6 border border-gray-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <GraduationCap className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-gray-900">Ban Cán Sự Lớp {state.config.className}</h3>
            </div>
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              {classLeaders.length} thành viên
            </span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-80 custom-scrollbar pr-1">
            {classLeaders.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">
                Chưa phân công ban cán sự lớp.
              </p>
            ) : (
              classLeaders.map((s) => (
                <div
                  key={s.id}
                  onClick={() => onSelectStudent(s.id)}
                  className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-indigo-500 to-violet-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                      {s.name.charAt(s.name.lastIndexOf(' ') + 1) || s.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">
                        {s.name}
                      </div>
                      <div className="text-[11px] font-medium text-indigo-600">
                        {s.position}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* TOP 5 HỌC TẬP - Chỉ dựa trên điểm học tập thực tế (ĐTB) */}
        <div className="bg-white rounded-3xl p-5 lg:p-6 border border-gray-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <Trophy className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-gray-900 uppercase tracking-tight">TOP 5 HỌC TẬP</h3>
            </div>
            <span className="text-xs font-bold text-[#1E293B] bg-[#FCF4F6] px-2.5 py-0.5 rounded-full border border-[#EDB5C1]">
              Lớp {state.config.className}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-80 custom-scrollbar pr-1">
            {topAcademicStudents.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-400 font-medium">
                Chưa có dữ liệu học tập để xếp hạng
              </div>
            ) : (
              topAcademicStudents.map((item) => (
                <div
                  key={item.student.id}
                  onClick={() => onSelectStudent(item.student.id)}
                  className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-[#FCF4F6]/60 border border-transparent hover:border-[#EDB5C1] transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                        item.rank === 1
                          ? 'bg-amber-400 text-amber-950 shadow-xs ring-1 ring-amber-300'
                          : item.rank === 2
                          ? 'bg-slate-200 text-slate-800'
                          : item.rank === 3
                          ? 'bg-amber-700/60 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      #{item.rank}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-gray-800 group-hover:text-[#1E293B] truncate">
                        {item.student.name}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate">
                        Mã HS: <span className="font-mono text-gray-600">{item.student.id}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                      ĐTB: {item.avgGrade.toFixed(1).replace('.', ',')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Thông báo mới nhất */}
        <div className="bg-white rounded-3xl p-5 lg:p-6 border border-gray-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <Bell className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-gray-900">Bảng Tin Mới Nhất</h3>
            </div>
            <button
              onClick={() => onNavigate('board')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
            >
              <span>Tất cả</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-80 custom-scrollbar pr-1">
            {recentNotices.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">
                Chưa có thông báo nào.
              </p>
            ) : (
              recentNotices.map((n) => (
                <div
                  key={n.id}
                  className="p-3 rounded-2xl bg-gray-50 border border-gray-200/60 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-800 line-clamp-1">
                      {n.title}
                    </span>
                    {n.pinned && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 shrink-0">
                        Ghim
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                    {n.content}
                  </p>
                  <div className="mt-2 text-[10px] text-gray-400 flex items-center justify-between">
                    <span>{n.author || 'GVCN'}</span>
                    <span>{n.date}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

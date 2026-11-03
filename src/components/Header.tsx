import React from 'react';
import {
  Menu,
  GraduationCap,
  Cloud,
  CloudCheck,
  CloudAlert,
  KeyRound,
  User,
  LogOut,
  ChevronDown,
  Layers,
  Calendar,
  School,
  Edit2,
  Sparkles,
} from 'lucide-react';
import { SyncStatus } from '../services/supabaseService';

interface HeaderProps {
  title: string;
  className: string;
  schoolName?: string;
  schoolYear?: string;
  teacherName: string;
  isTeacher: boolean;
  studentName?: string;
  syncStatus: SyncStatus;
  onOpenMobileSidebar: () => void;
  onOpenClassSwitch: () => void;
  onGoHome: () => void;
  onOpenSupabaseModal: () => void;
  onOpenChangePassword: () => void;
  onOpenMyProfile: () => void;
  onOpenQuickEditSchool?: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  className,
  schoolName,
  schoolYear,
  teacherName,
  isTeacher,
  studentName,
  syncStatus,
  onOpenMobileSidebar,
  onOpenClassSwitch,
  onGoHome,
  onOpenSupabaseModal,
  onOpenChangePassword,
  onOpenMyProfile,
  onOpenQuickEditSchool,
  onLogout,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);

  const todayText = React.useMemo(() => {
    const d = new Date();
    const days = [
      'Chủ Nhật',
      'Thứ Hai',
      'Thứ Ba',
      'Thứ Tư',
      'Thứ Năm',
      'Thứ Sáu',
      'Thứ Bảy',
    ];
    return `${days[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  }, []);

  return (
    <header className="h-16 lg:h-20 bg-white/95 backdrop-blur-md border-b border-[#EDB5C1]/60 px-3 sm:px-4 lg:px-7 flex items-center justify-between shrink-0 shadow-xs z-30 transition-all">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile menu trigger */}
        <button
          onClick={onOpenMobileSidebar}
          aria-label="Mở thực đơn"
          className="lg:hidden p-2 rounded-xl text-[#1E293B] hover:bg-[#FCF4F6] transition-colors cursor-pointer shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Góc trái màn hình: Logo và tiêu đề TRỢ LÝ CHỦ NHIỆM + bộ chọn lớp */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div
            onClick={onGoHome}
            title={`TRỢ LÝ CHỦ NHIỆM - Lớp ${className}`}
            className="w-10 h-10 lg:w-11 lg:h-11 rounded-2xl bg-[#EDB5C1] text-[#1E293B] flex items-center justify-center shadow-md shadow-[#EDB5C1]/30 ring-2 ring-[#EDB5C1]/50 shrink-0 cursor-pointer active:scale-95 transition-transform"
          >
            <GraduationCap className="w-6 h-6 text-[#1E293B] stroke-[2.2]" />
          </div>

          {/* School Name & Class info display */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base lg:text-lg font-black text-gray-900 tracking-tight flex items-center gap-1.5 truncate">
                <span>TRỢ LÝ CHỦ NHIỆM</span>
              </h1>

              {/* Bộ chọn lớp trên cả máy tính và điện thoại */}
              {isTeacher ? (
                <button
                  type="button"
                  onClick={onOpenClassSwitch}
                  title={`Bấm để chuyển đổi lớp (Đang chọn: Lớp ${className})`}
                  className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-[#FCF4F6] hover:bg-[#F8E2E7] text-[#1E293B] border border-[#EDB5C1] shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
                >
                  <Layers className="w-3.5 h-3.5 text-[#C98292] shrink-0" />
                  <span>Lớp {className}</span>
                  <ChevronDown className="w-3 h-3 text-[#C98292] shrink-0" />
                </button>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold bg-[#FCF4F6] text-[#1E293B] border border-[#EDB5C1] shadow-2xs shrink-0">
                  Lớp {className}
                </span>
              )}
            </div>

            {/* Subtitle with School Name & School Year */}
            <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] lg:text-xs text-gray-500 mt-0.5 truncate">
              <span
                className="font-semibold text-gray-700 truncate max-w-[120px] sm:max-w-[200px] md:max-w-[280px]"
                title={schoolName || 'Trường THCS'}
              >
                {schoolName || 'Trường THCS'}
              </span>
              <span className="text-gray-300 hidden sm:inline">•</span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[#1E293B] font-medium">
                <Calendar className="w-3 h-3 text-[#C98292] shrink-0" />
                <span>Năm học {schoolYear || '2024 - 2025'}</span>
              </span>

              {/* Nút sửa nhanh thông tin trường và năm học */}
              {isTeacher && onOpenQuickEditSchool && (
                <button
                  type="button"
                  onClick={onOpenQuickEditSchool}
                  title="Chỉnh sửa linh động tên trường, lớp và năm học"
                  className="hidden md:inline-flex px-2 py-0.5 rounded-lg bg-[#FCF4F6] hover:bg-[#F8E2E7] text-[#1E293B] text-[10px] font-bold border border-[#EDB5C1] transition-all items-center gap-1 cursor-pointer ml-1 active:scale-95"
                >
                  <Edit2 className="w-2.5 h-2.5 text-[#C98292]" />
                  <span>Sửa trường</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 lg:gap-3 shrink-0">
        {/* Cloud Sync Status Pill */}
        <button
          onClick={onOpenSupabaseModal}
          title={
            syncStatus.isTableReady
              ? `Đồng bộ Cloud đã sẵn sàng. Lần cuối: ${syncStatus.lastSyncedAt || 'Vừa xong'}`
              : syncStatus.isConnected
              ? 'Đang kết nối Supabase, cần tạo bảng.'
              : 'Chưa cấu hình Supabase Cloud (lưu trữ cục bộ)'
          }
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all border ${
            syncStatus.isTableReady
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              : syncStatus.isConnected
              ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
          }`}
        >
          {syncStatus.isTableReady ? (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          ) : syncStatus.isConnected ? (
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          ) : (
            <Cloud className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span className="hidden sm:inline">
            {syncStatus.isTableReady
              ? 'Cloud Sync'
              : syncStatus.isConnected
              ? 'Chưa tạo bảng'
              : 'Lưu Cục Bộ'}
          </span>
        </button>

        {/* User profile / actions dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors bg-white"
          >
            <div className="w-7 h-7 rounded-lg bg-linear-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {isTeacher ? 'GV' : (studentName ? studentName.charAt(0) : 'HS')}
            </div>
            <div className="text-left hidden md:block">
              <div className="text-xs font-bold text-gray-800 leading-tight">
                {isTeacher
                  ? teacherName.startsWith('Cô ') || teacherName.startsWith('Thầy ')
                    ? teacherName
                    : `Cô ${teacherName}`
                  : studentName || 'Học sinh'}
              </div>
              <div className="text-[10px] text-gray-400">
                {isTeacher ? 'Giáo viên chủ nhiệm' : 'Học sinh lớp'}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-0.5" />
          </button>

          {isDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50 animate-fadeIn">
                <div className="px-3.5 py-2 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-900">
                    {isTeacher ? teacherName : studentName}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {isTeacher ? 'Quyền Quản trị Lớp học' : `Lớp ${className}`}
                  </p>
                </div>

                {!isTeacher && (
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenMyProfile();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 cursor-pointer"
                  >
                    <User className="w-4 h-4 text-gray-400" />
                    <span>Hồ sơ của tôi</span>
                  </button>
                )}

                {isTeacher && (
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenClassSwitch();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-gray-400" />
                    <span>Chuyển đổi lớp học</span>
                  </button>
                )}

                {isTeacher && (
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenChangePassword();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2.5"
                  >
                    <KeyRound className="w-4 h-4 text-gray-400" />
                    <span>Đổi mật khẩu giáo viên</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onOpenSupabaseModal();
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2.5"
                >
                  <Cloud className="w-4 h-4 text-gray-400" />
                  <span>Cài đặt Đám mây (Supabase)</span>
                </button>

                <div className="my-1 border-t border-gray-100" />

                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onLogout();
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

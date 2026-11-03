import React from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Megaphone,
  Settings,
  LogOut,
  Layers,
  KeyRound,
  X,
  Cloud,
  Grid3X3,
  User,
  GraduationCap,
  ChevronDown,
} from 'lucide-react';
import { SyncStatus } from '../services/supabaseService';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  className: string;
  schoolName?: string;
  classAvatar?: string;
  isTeacher: boolean;
  studentName?: string;
  teacherName?: string;
  onUpdateClassAvatar?: (base64: string) => void;
  onOpenClassSwitch: () => void;
  onLogout: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenSupabaseModal: () => void;
  onOpenChangePassword: () => void;
  onOpenMyProfile: () => void;
  syncStatus: SyncStatus;
  activeBoardTab?: 'notices' | 'seating' | 'honor';
  onSelectBoardTab?: (tab: 'notices' | 'seating' | 'honor') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  className,
  schoolName,
  classAvatar,
  isTeacher,
  studentName,
  teacherName,
  onOpenClassSwitch,
  onLogout,
  isMobileOpen,
  onCloseMobile,
  onOpenSupabaseModal,
  onOpenChangePassword,
  onOpenMyProfile,
  syncStatus,
  activeBoardTab = 'notices',
  onSelectBoardTab,
}) => {
  const teacherNavItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'students', label: 'Học sinh', icon: GraduationCap },
    { id: 'attendance', label: 'Điểm danh', icon: CalendarCheck },
    { id: 'board', label: 'Bảng tin & Sơ đồ lớp', icon: Megaphone },
    { id: 'settings', label: 'Cài đặt & Sao lưu', icon: Settings },
  ];

  const studentNavItems = [
    {
      id: 'board_notices',
      label: 'Bảng tin thông báo',
      icon: Megaphone,
      action: () => {
        onNavigate('board');
        if (onSelectBoardTab) onSelectBoardTab('notices');
      },
      isActive: currentView === 'board' && activeBoardTab === 'notices',
    },
    {
      id: 'board_seating',
      label: 'Sơ đồ lớp học',
      icon: Grid3X3,
      action: () => {
        onNavigate('board');
        if (onSelectBoardTab) onSelectBoardTab('seating');
      },
      isActive: currentView === 'board' && activeBoardTab === 'seating',
    },
    {
      id: 'student_profile',
      label: 'Hồ sơ của tôi',
      icon: User,
      action: () => {
        onOpenMyProfile();
      },
      isActive: false,
    },
  ];

  const content = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 border-r border-slate-800">
      {/* Mobile drawer header (Chỉ hiển thị trên điện thoại khi mở menu kéo ra) */}
      <div className="lg:hidden p-3.5 border-b border-slate-800/80 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Menu Điều Hướng
        </span>
        <button
          onClick={onCloseMobile}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          aria-label="Đóng menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Header Info Branding - Layout theo mẫu 8A3 với tông màu hồng 6A8 */}
      <div className="p-4 border-b border-slate-800/80 space-y-2.5">
        <div className="flex items-center gap-3">
          {/* Biểu tượng mũ tốt nghiệp trong ô bo góc màu hồng #EDB5C1 */}
          <div className="w-11 h-11 rounded-2xl bg-[#EDB5C1] text-[#1E293B] flex items-center justify-center font-black shadow-md shadow-[#EDB5C1]/20 border border-[#E5B2BD]/50 shrink-0">
            <GraduationCap className="w-6 h-6 text-[#1E293B]" />
          </div>

          <div className="min-w-0 flex-1">
            {/* Dòng 1: Tiêu đề TRỢ LÝ CHỦ NHIỆM */}
            <h1 className="font-black text-sm tracking-tight text-white truncate">
              TRỢ LÝ CHỦ NHIỆM
            </h1>

            {/* Dòng 2: Nút bấm hình viên thuốc hiển thị tên lớp Lớp 6A8 ▾ */}
            <button
              type="button"
              onClick={onOpenClassSwitch}
              className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EDB5C1]/20 text-[#EDB5C1] hover:bg-[#EDB5C1]/30 border border-[#EDB5C1]/40 transition-colors cursor-pointer"
              title="Đổi lớp hoặc năm học"
            >
              <span>Lớp {className || '6A8'}</span>
              <ChevronDown className="w-3 h-3 text-[#EDB5C1]" />
            </button>
          </div>
        </div>

        {/* Dòng 3: Tên giáo viên chủ nhiệm */}
        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium pl-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span className="truncate">
            GVCN: {teacherName || 'Cô Lê Thị Kim Thanh'}
          </span>
        </div>

        {/* Dòng 4: Khối trạng thái Supabase */}
        <button
          type="button"
          onClick={onOpenSupabaseModal}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/70 text-xs text-slate-300 transition-colors cursor-pointer group"
          title="Cấu hình kết nối Supabase Cloud"
        >
          <div className="flex items-center gap-2">
            <Cloud className="w-3.5 h-3.5 text-[#EDB5C1]" />
            <span className="text-[11px] font-medium text-slate-300">
              Supabase: {syncStatus.isConnected ? 'Đã kết nối' : 'Chưa kết nối'}
            </span>
          </div>
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              syncStatus.isConnected
                ? 'bg-emerald-400 ring-2 ring-emerald-400/20'
                : 'bg-rose-400 ring-2 ring-rose-400/20'
            }`}
          />
        </button>
      </div>

      {/* Role Banner for Student when logged in */}
      {!isTeacher && (
        <div className="px-4 pt-2.5 pb-0.5">
          <div className="px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="font-semibold text-slate-300 truncate">
                {studentName ? `Học sinh: ${studentName}` : 'Học sinh'}
              </span>
            </div>
            <button
              onClick={onOpenMyProfile}
              className="text-[11px] text-[#EDB5C1] hover:text-[#F8E2E7] font-bold shrink-0 ml-1 cursor-pointer"
            >
              Hồ sơ
            </button>
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
        {isTeacher ? (
          teacherNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all text-left cursor-pointer ${
                  isActive
                    ? 'bg-[#EDB5C1] text-[#1E293B] shadow-md shadow-[#EDB5C1]/25 font-black'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-transform ${
                    isActive ? 'scale-110 text-[#1E293B]' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })
        ) : (
          studentNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.isActive;
            return (
              <button
                key={item.id}
                onClick={() => {
                  item.action();
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all text-left cursor-pointer ${
                  isActive
                    ? 'bg-[#EDB5C1] text-[#1E293B] shadow-md shadow-[#EDB5C1]/25 font-black'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-transform ${
                    isActive ? 'scale-110 text-[#1E293B]' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })
        )}
      </nav>

      {/* Quick shortcuts for Teacher */}
      {isTeacher && (
        <div className="px-3 py-2 border-t border-slate-800/80 space-y-1">
          <button
            onClick={() => {
              onOpenClassSwitch();
              onCloseMobile();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          >
            <Layers className="w-4 h-4 text-slate-400" />
            <span>Chuyển Đổi Lớp Học</span>
          </button>
          <button
            onClick={() => {
              onOpenChangePassword();
              onCloseMobile();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          >
            <KeyRound className="w-4 h-4 text-slate-400" />
            <span>Đổi Mật Khẩu GV</span>
          </button>
        </div>
      )}

      {/* Footer: Vai trò bên trái & Nút Thoát bên phải (theo bố cục mẫu 8A3) */}
      <div className="p-3.5 border-t border-slate-800/80 flex items-center justify-between">
        <div className="min-w-0 pr-2">
          <p className="text-xs font-bold text-slate-200 truncate">
            {isTeacher ? 'Giáo viên' : (studentName || 'Học sinh')}
          </p>
          <p className="text-[11px] text-slate-400 truncate">
            {isTeacher ? 'Quyền quản lý' : `Lớp ${className || '6A8'}`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            onLogout();
            onCloseMobile();
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition-colors cursor-pointer shrink-0"
          title="Đăng xuất khỏi hệ thống"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Thoát</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop permanent sidebar */}
      <aside className="hidden lg:flex w-64 xl:w-72 h-full flex-col shrink-0 select-none">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-fadeIn">
            {content}
          </div>
        </div>
      )}
    </>
  );
};

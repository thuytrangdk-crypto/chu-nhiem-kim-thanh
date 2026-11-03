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
    { id: 'dashboard', label: 'Tổng quan Lớp', icon: LayoutDashboard },
    { id: 'students', label: 'Học sinh & Hồ sơ', icon: Users },
    { id: 'attendance', label: 'Điểm danh Chuyên cần', icon: CalendarCheck },
    { id: 'board', label: 'Bảng tin & Sơ đồ', icon: Megaphone },
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

      {/* Header Info Branding */}
      <div className="p-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-pink-500 to-rose-600 flex items-center justify-center font-black text-white shadow-md shadow-pink-500/25">
            {className || '6A8'}
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-sm tracking-tight text-white flex items-center gap-1.5">
              <span>TRỢ LÝ CHỦ NHIỆM</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-pink-500/20 text-pink-300 border border-pink-500/30">
                Lớp {className}
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {isTeacher
                ? schoolName || 'Trường THCS Chu Văn An'
                : teacherName
                ? `GVCN: ${teacherName}`
                : 'Sổ chủ nhiệm điện tử'}
            </p>
          </div>
        </div>

        {/* Supabase status badge */}
        <div className="mt-3 px-2.5 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Supabase Cloud:</span>
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {syncStatus.isConnected ? 'Đã kết nối' : 'Đang kết nối'}
          </span>
        </div>
      </div>

      {/* Role Pill Banner */}
      <div className="px-4 pt-3 pb-1">
        <div className="px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${
                isTeacher ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
            <span className="font-semibold text-slate-300 truncate">
              {isTeacher ? 'Giáo viên Chủ nhiệm' : `Học sinh: ${studentName || ''}`}
            </span>
          </div>
          {!isTeacher && (
            <button
              onClick={onOpenMyProfile}
              className="text-[11px] text-pink-400 hover:text-pink-300 font-bold shrink-0 ml-1 cursor-pointer"
            >
              Xem hồ sơ
            </button>
          )}
        </div>
      </div>

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
                    ? 'bg-linear-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-600/30 font-bold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-transform ${
                    isActive ? 'scale-110 text-white' : 'text-slate-400'
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
                    ? 'bg-linear-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-600/30 font-bold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-transform ${
                    isActive ? 'scale-110 text-white' : 'text-slate-400'
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

      {/* Footer / Cloud & Logout */}
      <div className="p-3 border-t border-slate-800/80 space-y-2">
        <button
          onClick={() => {
            onOpenSupabaseModal();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-xs text-slate-300 border border-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-indigo-400" />
            <span>Supabase Cloud</span>
          </div>
          <span
            className={`w-2 h-2 rounded-full ${
              syncStatus.isTableReady
                ? 'bg-emerald-400'
                : syncStatus.isConnected
                ? 'bg-amber-400'
                : 'bg-slate-500'
            }`}
          />
        </button>

        <button
          onClick={() => {
            onLogout();
            onCloseMobile();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Đăng xuất khỏi hệ thống</span>
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

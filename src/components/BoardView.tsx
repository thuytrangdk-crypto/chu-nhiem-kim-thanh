import React, { useState, useEffect, useMemo } from 'react';
import { AppState, BoardNotice } from '../types';
import {
  Megaphone,
  Pin,
  PlusCircle,
  Trash2,
  Calendar,
  User,
  Grid3X3,
  Trophy,
  GraduationCap,
  Sparkles,
  Award,
  ChevronRight,
  Star,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { generateId, getTodayStr, calculateAverageGrade, calculateTotalPoints } from '../utils/helpers';
import { getEmulationConfigForClass, evaluateStudentEmulation } from '../utils/emulationEvaluation';

interface BoardViewProps {
  state: AppState;
  onAddNotice: (notice: Omit<BoardNotice, 'id'>) => void;
  onDeleteNotice: (id: string) => void;
  onUpdateSeatingChart: (newChart: Record<string, string>) => void;
  onSelectStudent: (id: string) => void;
  isTeacher: boolean;
  authStudentId?: string | null;
  activeTab?: 'notices' | 'seating' | 'honor';
  onTabChange?: (tab: 'notices' | 'seating' | 'honor') => void;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

export const BoardView: React.FC<BoardViewProps> = ({
  state,
  onAddNotice,
  onDeleteNotice,
  onUpdateSeatingChart,
  onSelectStudent,
  isTeacher,
  authStudentId,
  activeTab: externalTab,
  onTabChange,
  onShowToast,
}) => {
  const [internalTab, setInternalTab] = useState<'notices' | 'seating' | 'honor'>('notices');
  const activeTab = externalTab || internalTab;

  const handleTabChange = (tab: 'notices' | 'seating' | 'honor') => {
    if (onTabChange) {
      onTabChange(tab);
    }
    setInternalTab(tab);
  };

  // Format teacher signature dynamically based on current teacher name
  const getTeacherSignature = (teacherName?: string) => {
    const t = (teacherName || '').trim();
    if (!t) return 'GVCN Lớp 6A8';
    if (
      t.toLowerCase().startsWith('cô ') ||
      t.toLowerCase().startsWith('thầy ') ||
      t.toLowerCase().startsWith('gvcn ')
    ) {
      return t.toLowerCase().startsWith('gvcn ') ? t : `GVCN ${t}`;
    }
    return `GVCN Cô ${t}`;
  };

  const formatNoticeAuthor = (author?: string) => {
    if (!author) return getTeacherSignature(state.config.teacherName);
    if (
      author.includes('Thùy Trang') ||
      author.toLowerCase().startsWith('gvcn') ||
      author === 'GVCN'
    ) {
      return getTeacherSignature(state.config.teacherName);
    }
    return author;
  };

  // Notice creation modal
  const [isAddNoticeOpen, setIsAddNoticeOpen] = useState(false);
  const [noticeForm, setNoticeForm] = useState<{
    title: string;
    content: string;
    priority: 'high' | 'normal' | 'info';
    pinned: boolean;
    author: string;
  }>({
    title: '',
    content: '',
    priority: 'normal',
    pinned: false,
    author: getTeacherSignature(state.config.teacherName),
  });

  // Seating assignment modal
  const [assigningDeskKey, setAssigningDeskKey] = useState<string | null>(null);

  const handleCreateNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeForm.title.trim()) {
      onShowToast('Vui lòng nhập tiêu đề thông báo', 'error');
      return;
    }
    onAddNotice({
      title: noticeForm.title.trim(),
      content: noticeForm.content.trim(),
      priority: noticeForm.priority,
      pinned: noticeForm.pinned,
      author: noticeForm.author.trim() || getTeacherSignature(state.config.teacherName),
      date: getTodayStr(),
    });
    setIsAddNoticeOpen(false);
    setNoticeForm({
      title: '',
      content: '',
      priority: 'normal',
      pinned: false,
      author: getTeacherSignature(state.config.teacherName),
    });
  };

  const seatingChart = state.seatingChart || {};

  const handleAssignStudent = (deskKey: string, studentId: string | '') => {
    const updated = { ...seatingChart };
    if (!studentId) {
      delete updated[deskKey];
    } else {
      // If student was already seated elsewhere, remove from old slot
      Object.keys(updated).forEach((k) => {
        if (updated[k] === studentId) {
          delete updated[k];
        }
      });
      updated[deskKey] = studentId;
    }
    onUpdateSeatingChart(updated);
    setAssigningDeskKey(null);
  };

  const handleAutoAssign = () => {
    const updated = { ...seatingChart };
    const seatedIds = new Set(Object.values(updated));
    const unseated = state.students.filter((s) => !seatedIds.has(s.id));

    let unseatedIdx = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 4; c++) {
        const key = `desk_${r}_${c}`;
        if (!updated[key] && unseatedIdx < unseated.length) {
          updated[key] = unseated[unseatedIdx].id;
          unseatedIdx++;
        }
      }
    }
    onUpdateSeatingChart(updated);
    onShowToast('Đã tự động xếp chỗ cho các học sinh còn lại!');
  };

  const handleClearSeating = () => {
    if (window.confirm('Bạn có chắc muốn xóa trắng toàn bộ sơ đồ chỗ ngồi?')) {
      onUpdateSeatingChart({});
      onShowToast('Đã xóa sơ đồ chỗ ngồi');
    }
  };

  // Sort notices: pinned first, then newest date
  const sortedNotices = useMemo(() => {
    return [...state.boardNotices].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.date || '').localeCompare(a.date || '');
    });
  }, [state.boardNotices]);

  // Top 5 Academic students calculation
  const topStudents = useMemo(() => {
    const list = state.students.map((s) => {
      const avg = calculateAverageGrade(s.grades || {});
      return {
        ...s,
        avgGrade: avg !== null ? avg : -1,
      };
    });
    const withGrades = list.filter((s) => s.avgGrade >= 0);
    withGrades.sort((a, b) => b.avgGrade - a.avgGrade);
    return withGrades.slice(0, 5);
  }, [state.students]);

  // Emulation leaderboard calculation
  const emulationLeaderboard = useMemo(() => {
    const activeCfg = getEmulationConfigForClass(
      state.classEmulationConfigs,
      state.emulationConfig,
      state.config.className,
      state.config.schoolYear
    );
    return state.students.map((s) => {
      const personal = state.discipline.filter((d) => d.studentId === s.id);
      const evalResult = evaluateStudentEmulation(s.id, personal, activeCfg);
      return {
        student: s,
        score: evalResult.finalTotalPoints,
        rating: s.officialConduct?.rating || evalResult.suggestedRating,
        bonusCount: personal.filter((p) => p.points > 0).length,
      };
    }).sort((a, b) => b.score - a.score);
  }, [state.students, state.discipline, state.classEmulationConfigs, state.emulationConfig, state.config.className, state.config.schoolYear]);

  // Check if current authenticated student has a seat
  const currentStudentDeskKey = useMemo(() => {
    if (!authStudentId) return null;
    return Object.keys(seatingChart).find((key) => seatingChart[key] === authStudentId) || null;
  }, [authStudentId, seatingChart]);

  return (
    <div className="space-y-5">
      {/* 3 Main Horizontal Sub-Tabs according to Section III & Image 5 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => handleTabChange('notices')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs ${
            activeTab === 'notices'
              ? 'bg-[#EDB5C1] text-[#1E293B] shadow-md shadow-[#EDB5C1]/25 border border-[#E5B2BD] font-black'
              : 'bg-white text-gray-700 hover:bg-[#FCF4F6] hover:text-[#1E293B] border border-gray-200/80'
          }`}
        >
          <Megaphone className="w-4 h-4 shrink-0 text-[#1E293B]" />
          <span>Bảng tin Thông báo</span>
        </button>

        <button
          onClick={() => handleTabChange('seating')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs ${
            activeTab === 'seating'
              ? 'bg-[#EDB5C1] text-[#1E293B] shadow-md shadow-[#EDB5C1]/25 border border-[#E5B2BD] font-black'
              : 'bg-white text-gray-700 hover:bg-[#FCF4F6] hover:text-[#1E293B] border border-gray-200/80'
          }`}
        >
          <Grid3X3 className="w-4 h-4 shrink-0 text-[#1E293B]" />
          <span>Sơ đồ lớp</span>
        </button>

        <button
          onClick={() => handleTabChange('honor')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs ${
            activeTab === 'honor'
              ? 'bg-[#EDB5C1] text-[#1E293B] shadow-md shadow-[#EDB5C1]/25 border border-[#E5B2BD] font-black'
              : 'bg-white text-gray-700 hover:bg-[#FCF4F6] hover:text-[#1E293B] border border-gray-200/80'
          }`}
        >
          <Trophy className="w-4 h-4 shrink-0 text-[#1E293B]" />
          <span>Vinh danh & Thi đua</span>
        </button>
      </div>

      {/* TAB 1: BẢNG TIN THÔNG BÁO (2-COLUMN LAYOUT ACCORDING TO IMAGE 5) */}
      {activeTab === 'notices' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Cột Trái (2 phần): Danh sách thông báo */}
          <div className="lg:col-span-2 space-y-4">
            {/* Header Box Trang thông tin */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#EDB5C1]/50 shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#FCF4F6] border border-[#EDB5C1] flex items-center justify-center text-[#1E293B] shrink-0 shadow-2xs">
                  <Megaphone className="w-5 h-5 text-[#1E293B]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                    Trang thông tin & Bảng tin Lớp {state.config.className || '6A8'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Các thông báo, kế hoạch và nhắc nhở từ GVCN đến lớp
                  </p>
                </div>
              </div>

              {isTeacher && (
                <button
                  onClick={() => {
                    setNoticeForm({
                      title: '',
                      content: '',
                      priority: 'normal',
                      pinned: false,
                      author: getTeacherSignature(state.config.teacherName),
                    });
                    setIsAddNoticeOpen(true);
                  }}
                  className="px-4 py-2 bg-[#EDB5C1] hover:bg-[#E4A7B4] active:scale-98 text-[#1E293B] font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Đăng tin</span>
                </button>
              )}
            </div>

            {/* Danh sách thông báo (xếp mới nhất lên đầu, read-only cho học sinh) */}
            <div className="space-y-3.5">
              {sortedNotices.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-gray-200/80 shadow-xs">
                  <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-gray-800">Bảng tin chưa có thông báo</h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    Các thông báo dặn dò của cô chủ nhiệm sẽ hiển thị tại đây.
                  </p>
                </div>
              ) : (
                sortedNotices.map((n) => {
                  const isHigh = n.priority === 'high';
                  const isInfo = n.priority === 'info';

                  return (
                    <div
                      key={n.id}
                      className={`bg-white rounded-3xl p-5 border shadow-xs transition-all hover:shadow-md relative overflow-hidden ${
                        n.pinned
                          ? 'border-[#EDB5C1] ring-2 ring-[#EDB5C1]/20'
                          : 'border-gray-200/80'
                      }`}
                    >
                      {/* Left accent bar */}
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                          isHigh
                            ? 'bg-rose-500'
                            : isInfo
                            ? 'bg-blue-500'
                            : n.pinned
                            ? 'bg-[#EDB5C1]'
                            : 'bg-emerald-500'
                        }`}
                      />

                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-gray-900 text-sm sm:text-base flex items-center gap-1.5">
                            {n.pinned ? (
                              <Pin className="w-4 h-4 text-[#C98292] fill-[#C98292] inline" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-[#C98292] inline" />
                            )}
                            {n.title}
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isHigh
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : isInfo
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : 'bg-[#FCF4F6] text-[#1E293B] border border-[#EDB5C1]'
                            }`}
                          >
                            {isHigh ? 'Khẩn / Quan trọng' : isInfo ? 'Nhắc nhở' : 'Thông tin'}
                          </span>
                        </div>

                        {isTeacher && (
                          <button
                            onClick={() => onDeleteNotice(n.id)}
                            className="p-1 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Xóa thông báo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-line mb-3 pl-1">
                        {n.content}
                      </p>

                      <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400 font-medium pl-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>Ngày đăng: {n.date}</span>
                        </span>
                        <span className="font-bold text-[#1E293B] flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          <span>{formatNoticeAuthor(n.author)}</span>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cột Phải (1 phần): TOP 5 HỌC TẬP & SƠ ĐỒ CHỖ NGỒI LỚP (Theo mẫu Ảnh 5) */}
          <div className="space-y-4">
            {/* THẺ 1: TOP 5 HỌC TẬP */}
            <div className="bg-white rounded-3xl p-5 border border-[#EDB5C1]/50 shadow-xs space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#FCF4F6] flex items-center justify-center text-[#1E293B] border border-[#EDB5C1]/40">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-black text-xs sm:text-sm text-gray-900 uppercase tracking-wider">
                        TOP 5 HỌC TẬP
                      </h3>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Bản nháp
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Tháng 11/2026 • ĐTB cao nhất
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleTabChange('honor')}
                  className="text-xs font-black text-[#1E293B] hover:text-black flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Xem bảng vàng</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {topStudents.length === 0 ? (
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 text-center space-y-1">
                  <div className="text-xs font-bold text-amber-900">
                    Bản nháp (Đang cập nhật)
                  </div>
                  <div className="text-[11px] text-amber-700 leading-snug">
                    Bảng xếp hạng Top 5 sẽ hiển thị sau khi GVCN công bố vinh danh.
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {topStudents.map((s, idx) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] text-white shrink-0 ${
                            idx === 0
                              ? 'bg-amber-500'
                              : idx === 1
                              ? 'bg-slate-400'
                              : idx === 2
                              ? 'bg-amber-700'
                              : 'bg-gray-400'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="font-bold text-gray-800 truncate">
                          {s.name}
                        </span>
                      </div>
                      <span className="font-black text-[#1E293B] shrink-0">
                        {s.avgGrade.toFixed(1)} đ
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* THẺ 2: SƠ ĐỒ CHỖ NGỒI LỚP (Màu hồng pastel #EDB5C1, chữ xanh đen #1E293B) */}
            <div
              onClick={() => handleTabChange('seating')}
              className="bg-[#EDB5C1] text-[#1E293B] rounded-3xl p-5 shadow-md shadow-[#EDB5C1]/20 border border-[#E5B2BD] cursor-pointer hover:shadow-lg transition-all relative overflow-hidden group"
            >
              <div className="absolute right-3 -bottom-3 opacity-15 group-hover:opacity-25 transition-opacity text-[#1E293B]">
                <Grid3X3 className="w-24 h-24" />
              </div>

              <div className="relative z-10 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white/40 backdrop-blur-xs flex items-center justify-center">
                    <Grid3X3 className="w-4 h-4 text-[#1E293B]" />
                  </div>
                  <h3 className="font-black text-sm uppercase tracking-wider text-[#1E293B]">
                    SƠ ĐỒ CHỖ NGỒI LỚP
                  </h3>
                </div>

                <p className="text-xs text-slate-800 leading-relaxed">
                  Đã xếp vị trí bàn học cho {state.students.length} học sinh trong lớp {state.config.className || '6A8'}.
                </p>

                {currentStudentDeskKey && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 text-[#1E293B] text-[11px] font-black">
                    <Star className="w-3 h-3 fill-[#1E293B]" />
                    <span>Bạn đã có vị trí ngồi cụ thể!</span>
                  </div>
                )}

                <div className="pt-2 flex items-center gap-1.5 text-xs font-black text-[#1E293B] group-hover:translate-x-1 transition-transform">
                  <span>Mở xem sơ đồ lớp học</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SƠ ĐỒ LỚP HỌC (READ-ONLY CHO HỌC SINH, HIGHLIGHT VỊ TRÍ) */}
      {activeTab === 'seating' && (
        <div className="bg-white rounded-3xl p-5 sm:p-7 border border-[#EDB5C1]/50 shadow-xs space-y-6">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
                <span>Sơ Đồ Chỗ Ngồi Lớp {state.config.className || '6A8'}</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FCF4F6] text-[#1E293B] border border-[#EDB5C1]">
                  {state.students.length} Học sinh
                </span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {isTeacher
                  ? 'Giáo viên bấm vào bàn để xếp chỗ, hoặc sử dụng xếp tự động.'
                  : 'Sơ đồ lớp học chính thức do cô chủ nhiệm phân công.'}
              </p>
            </div>

            {isTeacher && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAutoAssign}
                  className="px-3.5 py-2 bg-[#FCF4F6] hover:bg-[#F8E2E7] text-[#1E293B] font-bold text-xs rounded-xl border border-[#EDB5C1]/60 transition-all cursor-pointer shadow-2xs"
                >
                  Xếp tự động
                </button>
                <button
                  onClick={handleClearSeating}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs"
                >
                  Xóa sơ đồ
                </button>
              </div>
            )}
          </div>

          {/* Student seat highlight badge */}
          {!isTeacher && authStudentId && currentStudentDeskKey && (
            <div className="p-3 rounded-2xl bg-[#FCF4F6] border border-[#EDB5C1] flex items-center gap-2 text-xs text-[#1E293B] font-bold">
              <Star className="w-4 h-4 fill-[#C98292] text-[#C98292] shrink-0" />
              <span>Vị trí ngồi của bạn đang được làm nổi bật với viền hồng trên sơ đồ bên dưới.</span>
            </div>
          )}

          {/* Teacher podium & Blackboard */}
          <div className="max-w-md mx-auto text-center space-y-2">
            <div className="py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-black tracking-wider uppercase shadow-md flex items-center justify-center gap-2">
              <span>BẢNG LỚP HỌC (PHÍA TRƯỚC)</span>
            </div>
            <div className="w-40 mx-auto py-1.5 bg-[#FCF4F6] border border-[#EDB5C1] text-[#1E293B] rounded-xl text-xs font-bold shadow-2xs">
              Bàn Giáo Viên
            </div>
          </div>

          {/* Desks Grid: 5 Rows x 4 Desks */}
          <div className="space-y-4 max-w-4xl mx-auto pt-2">
            {[0, 1, 2, 3, 4].map((rowIndex) => (
              <div key={rowIndex} className="space-y-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">
                  Hàng {rowIndex + 1}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
                  {[0, 1, 2, 3].map((colIndex) => {
                    const deskKey = `desk_${rowIndex}_${colIndex}`;
                    const assignedStudentId = seatingChart[deskKey];
                    const student = state.students.find(
                      (s) => s.id === assignedStudentId
                    );
                    const isMySeat = authStudentId && assignedStudentId === authStudentId;

                    return (
                      <div
                        key={colIndex}
                        onClick={() => {
                          if (isTeacher) {
                            setAssigningDeskKey(deskKey);
                          } else if (student && student.id === authStudentId) {
                            onSelectStudent(student.id);
                          }
                        }}
                        className={`p-3 rounded-2xl border transition-all text-center flex flex-col justify-center items-center min-h-[105px] relative ${
                          isMySeat
                            ? 'bg-[#FCF4F6] border-[#EDB5C1] ring-4 ring-[#EDB5C1]/40 shadow-md shadow-[#EDB5C1]/20 cursor-pointer'
                            : student
                            ? 'bg-[#FCF4F6]/50 border-[#EDB5C1]/40 hover:border-[#EDB5C1] hover:shadow-2xs cursor-default'
                            : 'bg-gray-50/60 border-dashed border-gray-300'
                        }`}
                      >
                        {isMySeat && (
                          <span className="absolute -top-2.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#EDB5C1] text-[#1E293B] shadow-xs border border-[#E5B2BD]">
                            Vị trí của bạn
                          </span>
                        )}

                        {student ? (
                          <>
                            <div
                              className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center mb-1 shadow-2xs ${
                                isMySeat
                                  ? 'bg-[#EDB5C1] text-[#1E293B] font-black ring-2 ring-white'
                                  : 'bg-slate-700 text-white'
                              }`}
                            >
                              {student.name.charAt(student.name.lastIndexOf(' ') + 1) ||
                                student.name.charAt(0)}
                            </div>
                            <div className={`text-xs font-bold line-clamp-1 ${isMySeat ? 'text-[#1E293B] font-black' : 'text-gray-900'}`}>
                              {student.name}
                            </div>
                            <div className="text-[10px] text-gray-500 font-semibold line-clamp-1">
                              {student.position || 'Học sinh'}
                            </div>
                          </>
                        ) : (
                          <div className="text-gray-400 text-xs">
                            <span className="font-medium">Chỗ trống</span>
                            {isTeacher && (
                              <div className="text-[10px] text-[#1E293B] font-bold mt-0.5 cursor-pointer">
                                + Xếp chỗ
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: VINH DANH & THI ĐUA */}
      {activeTab === 'honor' && (
        <div className="space-y-5">
          {/* Hero Banner Vinh Danh */}
          <div className="bg-[#EDB5C1] text-[#1E293B] rounded-3xl p-6 sm:p-8 shadow-md shadow-[#EDB5C1]/20 border border-[#E5B2BD] relative overflow-hidden">
            <div className="relative z-10 max-w-xl space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 backdrop-blur-xs text-xs font-black text-[#1E293B] border border-[#EDB5C1]">
                <Trophy className="w-3.5 h-3.5 text-[#1E293B]" />
                <span>BẢNG VÀNG THI ĐUA LỚP {state.config.className || '6A8'}</span>
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1E293B]">
                Vinh Danh & Thi Đua Nền Nếp
              </h2>
              <p className="text-xs sm:text-sm text-slate-800">
                Ghi nhận những nỗ lực học tập xuất sắc và thành tích rèn luyện nề nếp nổi bật của học sinh trong tuần và tháng.
              </p>
            </div>
          </div>

          {/* Leaderboard Table & Emulation Cards */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#EDB5C1]/50 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-[#1E293B]" />
                <span>Bảng Xếp Hạng Điểm Thi Đua Tích Cực</span>
              </h3>
              <span className="text-xs font-semibold text-gray-400">
                Cập nhật theo dữ liệu thực tế
              </span>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3 w-14 text-center">Hạng</th>
                    <th className="py-2.5 px-3">Học sinh</th>
                    <th className="py-2.5 px-3 text-center">Chức vụ</th>
                    <th className="py-2.5 px-3 text-center">Điểm Thi Đua</th>
                    <th className="py-2.5 px-3 text-center">Xếp Loại</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {emulationLeaderboard.slice(0, 15).map((item, idx) => {
                    const isSelf = authStudentId && item.student.id === authStudentId;
                    return (
                      <tr
                        key={item.student.id}
                        className={`hover:bg-[#FCF4F6]/50 transition-colors ${
                          isSelf ? 'bg-[#FCF4F6] font-bold' : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-xs ${
                              idx === 0
                                ? 'bg-amber-400 text-white shadow-2xs'
                                : idx === 1
                                ? 'bg-slate-300 text-slate-800'
                                : idx === 2
                                ? 'bg-amber-700 text-white'
                                : 'text-gray-500'
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">
                              {item.student.name}
                            </span>
                            {isSelf && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-[#EDB5C1] text-[#1E293B] border border-[#E5B2BD]">
                                Bạn
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center text-gray-500 text-xs">
                          {item.student.position || 'Học sinh'}
                        </td>
                        <td className="py-3 px-3 text-center font-black text-[#1E293B] text-sm">
                          {item.score} đ
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              item.rating === 'Tốt'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : item.rating === 'Khá'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : item.rating === 'Đạt'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {item.rating}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD NOTICE (GV ONLY) */}
      {isAddNoticeOpen && isTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
            <div className="p-5 border-b border-[#E5B2BD] flex items-center justify-between bg-[#EDB5C1] text-[#1E293B]">
              <h3 className="font-black text-base">Đăng Thông Báo Lớp Mới</h3>
              <button
                onClick={() => setIsAddNoticeOpen(false)}
                className="text-[#1E293B] hover:text-black text-lg font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNotice} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Tiêu Đề Thông Báo *
                </label>
                <input
                  type="text"
                  required
                  value={noticeForm.title}
                  onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                  placeholder="Ví dụ: Kế hoạch kiểm tra giữa kỳ..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Nội Dung Chi Tiết *
                </label>
                <textarea
                  rows={4}
                  required
                  value={noticeForm.content}
                  onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })}
                  placeholder="Nhập nội dung dặn dò học sinh và phụ huynh..."
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Mức Độ Ưu Tiên
                  </label>
                  <select
                    value={noticeForm.priority}
                    onChange={(e) =>
                      setNoticeForm({ ...noticeForm, priority: e.target.value as any })
                    }
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]"
                  >
                    <option value="normal">Thông báo thường</option>
                    <option value="high">Khẩn / Quan trọng</option>
                    <option value="info">Nhắc nhở</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Người Ký / Đăng
                  </label>
                  <input
                    type="text"
                    value={noticeForm.author}
                    onChange={(e) => setNoticeForm({ ...noticeForm, author: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pinCheck"
                  checked={noticeForm.pinned}
                  onChange={(e) => setNoticeForm({ ...noticeForm, pinned: e.target.checked })}
                  className="rounded text-[#EDB5C1] focus:ring-[#EDB5C1] w-4 h-4 cursor-pointer accent-[#EDB5C1]"
                />
                <label htmlFor="pinCheck" className="text-xs font-bold text-gray-700 cursor-pointer">
                  Ghim thông báo này lên đầu bảng tin
                </label>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddNoticeOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold text-xs hover:bg-gray-50 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#EDB5C1] hover:bg-[#E4A7B4] text-[#1E293B] font-black text-xs shadow-md shadow-[#EDB5C1]/25 cursor-pointer"
                >
                  Đăng Thông Báo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN SEAT (GV ONLY) */}
      {assigningDeskKey && isTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#E5B2BD] flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-[#E5B2BD] flex items-center justify-between bg-[#EDB5C1] text-[#1E293B]">
              <h3 className="font-black text-sm">Xếp Học Sinh Vào Chỗ Ngồi</h3>
              <button
                onClick={() => setAssigningDeskKey(null)}
                className="text-[#1E293B] hover:text-black font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2">
              <button
                onClick={() => handleAssignStudent(assigningDeskKey, '')}
                className="w-full p-2.5 rounded-xl text-left text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                ✕ Để trống chỗ ngồi này
              </button>

              <div className="border-t border-gray-100 my-2" />

              <div className="space-y-1">
                {state.students.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleAssignStudent(assigningDeskKey, s.id)}
                    className="w-full p-2.5 rounded-xl text-left text-xs font-medium text-gray-800 hover:bg-[#FCF4F6] hover:text-[#1E293B] transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>{s.name}</span>
                    <span className="text-[10px] text-gray-400">
                      {s.position || 'Học sinh'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

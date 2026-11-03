import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  AppState,
  ConductGrade,
  DisciplineRecord,
  NoteRecord,
  Student,
} from '../types';
import {
  User,
  Phone,
  MapPin,
  Calendar,
  Award,
  GraduationCap,
  Clock,
  BookOpen,
  MessageSquare,
  KeyRound,
  Camera,
  X,
  PlusCircle,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Star,
  Edit2,
  History,
} from 'lucide-react';
import {
  calculateAverageGrade,
  calculateTotalPoints,
  formatViDate,
  getConductFromGrade,
  getTodayStr,
  STATUS_META,
  SUBJECT_LIST,
} from '../utils/helpers';
import { DEFAULT_DISCIPLINE_RULES } from '../defaultData';
import {
  getEmulationConfigForClass,
  evaluateStudentEmulation,
} from '../utils/emulationEvaluation';

interface StudentProfileModalProps {
  studentId: string;
  state: AppState;
  isTeacher: boolean;
  onClose: () => void;
  onEditStudent: (s: Student) => void;
  onUpdateAvatar: (studentId: string, base64: string) => void;
  onSaveGrades: (studentId: string, grades: Record<string, number>) => void;
  onAddDiscipline: (record: Omit<DisciplineRecord, 'id'>) => void;
  onDeleteDiscipline: (id: string) => void;
  onAddNote: (record: Omit<NoteRecord, 'id'>) => void;
  onDeleteNote: (id: string) => void;
  onChangePassword: (studentId: string, newPass: string) => void;
  onLogout: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  studentId,
  state,
  isTeacher,
  onClose,
  onEditStudent,
  onUpdateAvatar,
  onSaveGrades,
  onAddDiscipline,
  onDeleteDiscipline,
  onAddNote,
  onDeleteNote,
  onChangePassword,
  onLogout,
  onShowToast,
}) => {
  const student = state.students.find((s) => s.id === studentId);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const rulesList =
    state.disciplineRules && state.disciplineRules.length > 0
      ? state.disciplineRules
      : DEFAULT_DISCIPLINE_RULES;

  const [activeTab, setActiveTab] = useState<
    'info' | 'grades' | 'discipline' | 'attendance' | 'notes' | 'password'
  >('info');

  // Grades state
  const [grades, setGrades] = useState<Record<string, number>>(
    student?.grades || {}
  );

  // Discipline record form state (Teacher only)
  const [disciplineDate, setDisciplineDate] = useState<string>(getTodayStr());
  const [selectedRuleIndex, setSelectedRuleIndex] = useState<number>(0);
  const [customRuleName, setCustomRuleName] = useState<string>('');
  const [customPoints, setCustomPoints] = useState<number>(-2);
  const [disciplineNote, setDisciplineNote] = useState<string>('');

  // Selected evaluation period: 'all' | 'year' | 'hk1' | 'hk2' | 'YYYY-MM'
  const currentMonthStr = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1
  ).padStart(2, '0')}`;
  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentMonthStr);

  // Note form state (Teacher only)
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // Password state (Teacher only)
  const [newPassword, setNewPassword] = useState('');

  if (!student) return null;

  // Personal discipline records
  const personalDiscipline = state.discipline.filter(
    (d) => d.studentId === student.id
  );
  const totalPoints = calculateTotalPoints(state.discipline, student.id);

  // Available evaluation periods list
  const periodOptions = useMemo(() => {
    return [
      { id: 'all', label: 'Tất cả thời gian' },
      { id: '2026-09', label: 'Tháng 9/2026' },
      { id: '2026-10', label: 'Tháng 10/2026' },
      { id: '2026-11', label: 'Tháng 11/2026' },
      { id: '2026-12', label: 'Tháng 12/2026' },
      { id: '2027-01', label: 'Tháng 1/2027' },
      { id: '2027-02', label: 'Tháng 2/2027' },
      { id: '2027-03', label: 'Tháng 3/2027' },
      { id: '2027-04', label: 'Tháng 4/2027' },
      { id: '2027-05', label: 'Tháng 5/2027' },
      { id: 'hk1', label: 'Học kỳ I' },
      { id: 'hk2', label: 'Học kỳ II' },
      { id: 'year', label: 'Cả năm học (2026 - 2027)' },
    ];
  }, []);

  // Filter discipline records by period
  const displayedDiscipline = useMemo(() => {
    if (selectedPeriod === 'all' || selectedPeriod === 'year') {
      return personalDiscipline;
    }
    if (selectedPeriod === 'hk1') {
      return personalDiscipline.filter((d) => {
        const m = d.date?.substring(5, 7);
        return ['09', '10', '11', '12', '01'].includes(m);
      });
    }
    if (selectedPeriod === 'hk2') {
      return personalDiscipline.filter((d) => {
        const m = d.date?.substring(5, 7);
        return ['02', '03', '04', '05'].includes(m);
      });
    }
    return personalDiscipline.filter(
      (d) => d.date && d.date.startsWith(selectedPeriod)
    );
  }, [personalDiscipline, selectedPeriod]);

  // Breakdown of bonus and penalty points in the selected period
  const { periodBonusPoints, periodPenaltyPoints, periodNetPoints } = useMemo(() => {
    let bonus = 0;
    let penalty = 0;
    displayedDiscipline.forEach((d) => {
      const p = d.points || 0;
      if (p > 0) bonus += p;
      else if (p < 0) penalty += Math.abs(p);
    });
    return {
      periodBonusPoints: bonus,
      periodPenaltyPoints: penalty,
      periodNetPoints: bonus - penalty,
    };
  }, [displayedDiscipline]);

  // Active emulation config for current class & year
  const activeEmulationConfig = useMemo(() => {
    return getEmulationConfigForClass(
      state.classEmulationConfigs,
      state.emulationConfig,
      state.config.className,
      state.config.schoolYear
    );
  }, [
    state.classEmulationConfigs,
    state.emulationConfig,
    state.config.className,
    state.config.schoolYear,
  ]);

  // Evaluate student emulation using configured scale and conduct tiers
  const studentEmulation = useMemo(() => {
    return evaluateStudentEmulation(
      student.id,
      displayedDiscipline,
      activeEmulationConfig
    );
  }, [student.id, displayedDiscipline, activeEmulationConfig]);

  // Official conduct evaluation modal & form state (Teacher only)
  const [isOfficialModalOpen, setIsOfficialModalOpen] = useState(false);
  const [officialRating, setOfficialRating] = useState<ConductGrade>(
    student.officialConduct?.rating ||
      (studentEmulation.suggestedRating as ConductGrade)
  );
  const [officialReason, setOfficialReason] = useState(
    student.officialConduct?.reason || ''
  );

  const handleConfirmOfficialConduct = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedStudent: Student = {
      ...student,
      officialConduct: {
        rating: officialRating,
        reason: officialReason.trim() || undefined,
        confirmedBy: state.config.teacherName || 'GVCN',
        confirmedAt: new Date().toLocaleString('vi-VN'),
      },
    };
    onEditStudent(updatedStudent);
    setIsOfficialModalOpen(false);
    onShowToast(
      `Đã xác nhận kết quả đánh giá rèn luyện chính thức: ${officialRating}!`
    );
  };

  // Personal attendance records
  const personalAttendance = state.attendance.filter(
    (a) => a.studentId === student.id
  );
  const countPresent = personalAttendance.filter((a) => a.status === 'c').length;
  const countLate = personalAttendance.filter((a) => a.status === 'm').length;
  const countExcused = personalAttendance.filter((a) => a.status === 'v').length;
  const countUnexcused = personalAttendance.filter(
    (a) => a.status === 'kp'
  ).length;

  // Personal notes
  const personalNotes = state.notes.filter((n) => n.studentId === student.id);

  // Average grade
  const avgGrade = calculateAverageGrade(grades);
  const academicRank = getConductFromGrade(avgGrade);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onUpdateAvatar(student.id, reader.result);
          onShowToast('Đã cập nhật ảnh đại diện học sinh');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveGradesSubmit = () => {
    onSaveGrades(student.id, grades);
    onShowToast('Đã lưu bảng điểm học tập');
  };

  const handleCreateDiscipline = (e: React.FormEvent) => {
    e.preventDefault();
    const ruleObj = rulesList[selectedRuleIndex] || rulesList[0];
    let finalRuleName = ruleObj.name;
    let finalPoints = ruleObj.points;
    let finalType = ruleObj.type;

    if (ruleObj.name === 'Khác') {
      finalRuleName = customRuleName.trim() || 'Sự việc khác';
      finalPoints = customPoints;
      finalType = customPoints >= 0 ? 'plus' : 'minus';
    }

    onAddDiscipline({
      studentId: student.id,
      date: disciplineDate || getTodayStr(),
      ruleName: finalRuleName,
      points: finalPoints,
      note: disciplineNote.trim(),
      type: finalType,
    });

    setDisciplineNote('');
    setCustomRuleName('');
    onShowToast('Đã lưu ghi nhận sự việc thi đua');
  };

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    onAddNote({
      studentId: student.id,
      date: getTodayStr(),
      title: noteTitle.trim() || 'Nhắc nhở của cô',
      content: noteContent.trim(),
      author: isTeacher ? `Cô ${state.config.teacherName}` : 'Học sinh',
    });

    setIsAddingNote(false);
    setNoteTitle('');
    setNoteContent('');
    onShowToast('Đã thêm ghi chú');
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) return;
    onChangePassword(student.id, newPassword.trim());
    setNewPassword('');
    onShowToast('Đã đổi mật khẩu đăng nhập của học sinh');
  };

  // Listen for ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const studentAge = useMemo(() => {
    if (!student?.dob) return null;
    const parts = student.dob.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const currentYear = new Date().getFullYear();
      const age = currentYear - year;
      if (age > 0 && age < 100) return age;
    }
    return null;
  }, [student?.dob]);

  // Tabs list: 4 tabs for student, 6 for teacher
  const navTabs = isTeacher
    ? [
        { id: 'info', label: 'Thông tin cá nhân', icon: User },
        { id: 'attendance', label: `Điểm danh (${personalAttendance.length})`, icon: Clock },
        { id: 'grades', label: 'Học tập & Điểm số', icon: BookOpen },
        { id: 'discipline', label: 'Thi đua & Kỷ luật', icon: Award },
        { id: 'notes', label: `Sổ tay & Dặn dò (${personalNotes.length})`, icon: MessageSquare },
        { id: 'password', label: 'Mật khẩu', icon: KeyRound },
      ]
    : [
        { id: 'info', label: 'Thông tin cá nhân', icon: User },
        { id: 'attendance', label: `Điểm danh (${personalAttendance.length})`, icon: Clock },
        { id: 'grades', label: 'Học tập & Điểm số', icon: BookOpen },
        { id: 'discipline', label: 'Thi đua & Kỷ luật', icon: Award },
      ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-slate-900/60 backdrop-blur-xs animate-fadeIn cursor-pointer"
      onClick={onClose}
    >
      <div
        className="w-[98vw] max-w-7xl h-[94vh] max-h-[96vh] bg-white rounded-3xl shadow-2xl overflow-hidden border border-pink-200/60 flex flex-col cursor-default relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút đóng duy nhất ở góc trên bên phải */}
        <button
          onClick={onClose}
          aria-label="Đóng"
          title="Đóng (Phím ESC)"
          className="absolute top-2.5 right-3 z-30 p-2 rounded-full bg-white/90 hover:bg-pink-100 text-gray-500 hover:text-gray-900 border border-pink-200/50 shadow-2xs transition-all cursor-pointer"
        >
          <X className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Modal Top Header with Student Info (Màu hồng phấn nhạt thanh lịch như mẫu) */}
        <div className="bg-linear-to-r from-[#fff2f5] via-[#fdf4f7] to-[#fff6f8] px-4 sm:px-6 pt-2.5 pb-0 shrink-0 border-b border-pink-200/60">
          <div className="flex items-center justify-between gap-3 pr-10">
            {/* Student info inline */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              {/* Avatar nhỏ gọn */}
              <div className="relative group shrink-0">
                {student.avatar ? (
                  <img
                    src={student.avatar}
                    alt={student.name}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-cover ring-2 ring-pink-200/60 shadow-2xs"
                  />
                ) : (
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-linear-to-br from-pink-500 via-rose-500 to-pink-600 flex items-center justify-center font-black text-sm sm:text-base text-white shadow-2xs ring-2 ring-pink-200/60">
                    {student.name.charAt(student.name.lastIndexOf(' ') + 1) ||
                      student.name.charAt(0)}
                  </div>
                )}
                {isTeacher && (
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    title="Tải ảnh đại diện học sinh"
                    className="absolute -bottom-1 -right-1 p-0.5 bg-gray-900 hover:bg-gray-800 text-white rounded-md shadow-xs transition-all cursor-pointer"
                  >
                    <Camera className="w-2.5 h-2.5" />
                  </button>
                )}
                <input
                  type="file"
                  ref={avatarInputRef}
                  onChange={handleAvatarUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              {/* Student name, class and metadata */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h3 className="text-sm sm:text-base font-black tracking-tight text-gray-900 uppercase truncate">
                    {student.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 text-pink-700 border border-pink-200/80">
                    {student.position || 'Học sinh'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white text-gray-700 border border-gray-200/70">
                    Lớp {state.config.className || '6A8'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
                  <span>
                    Mã: <strong className="text-gray-800">{student.id}</strong>
                  </span>
                  <span className="text-gray-300">•</span>
                  <span>
                    Sinh:{' '}
                    <strong className="text-gray-800">
                      {formatViDate(student.dob)}
                    </strong>
                    {studentAge ? ` (${studentAge}t)` : ''}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span>{student.gender}</span>
                  {student.parentPhone && (
                    <>
                      <span className="text-gray-300 hidden md:inline">•</span>
                      <span className="hidden md:inline">
                        PH:{' '}
                        <strong className="text-pink-600 font-semibold">
                          {student.parentPhone}
                        </strong>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 4 Mini Stat Pills at top right according to Section IV & Image 2 */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <div className="px-2.5 py-1 rounded-xl bg-pink-50 border border-pink-200/80 flex items-center gap-1 text-[11px]">
                <span className="text-gray-500 font-medium">Chuyên cần:</span>
                <span className="font-black text-pink-700">
                  {countPresent}b{countLate > 0 ? ` (${countLate}m)` : ''}
                </span>
              </div>
              <div className="px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center gap-1 text-[11px]">
                <span className="text-gray-500 font-medium">Điểm TB:</span>
                <span className="font-black text-blue-700">
                  {avgGrade !== null ? avgGrade.toFixed(1) : '--'}
                </span>
              </div>
              <div className="px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center gap-1 text-[11px]">
                <span className="text-gray-500 font-medium">Nề nếp:</span>
                <span className="font-black text-emerald-700">
                  {totalPoints >= 0 ? `+${totalPoints}` : totalPoints}đ
                </span>
              </div>
              <div className="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center gap-1 text-[11px]">
                <span className="text-gray-500 font-medium">Hạnh kiểm:</span>
                <span className="font-black text-amber-700">
                  {student.officialConduct?.rating ||
                    studentEmulation.suggestedRating ||
                    'Tốt'}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs (Thiết kế thanh tab gọn gàng ngay bên dưới) */}
          <div className="flex items-center gap-1 sm:gap-4 overflow-x-auto custom-scrollbar border-t border-pink-200/50 mt-1.5">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 py-1.5 px-1.5 text-xs sm:text-[13px] font-semibold transition-all whitespace-nowrap cursor-pointer relative ${
                    isActive
                      ? 'text-pink-600 font-bold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? 'text-pink-600' : 'text-gray-400'
                    }`}
                  />
                  <span>{tab.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-600 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Body / Tab Contents */}
        <div
          className={`flex-1 min-h-0 ${
            activeTab === 'discipline'
              ? 'p-3.5 sm:p-4 overflow-hidden flex flex-col'
              : 'p-5 sm:p-6 overflow-y-auto custom-scrollbar'
          }`}
        >
          {/* TAB 1: INFO (CHỈ ĐỌC CHO HỌC SINH) */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Personal & Parent details */}
                <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-3">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4 text-pink-600" />
                    <span>Thông Tin Liên Lạc Phụ Huynh</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span className="text-gray-500">Họ tên Phụ huynh:</span>
                      <strong className="text-gray-800">
                        {student.parentName || 'Chưa cập nhật'}
                      </strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span className="text-gray-500">Số điện thoại PH:</span>
                      <strong className="text-pink-600 font-bold">
                        {student.parentPhone || 'Chưa cập nhật'}
                      </strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span className="text-gray-500">Số điện thoại HS:</span>
                      <strong className="text-gray-800">
                        {student.phone || 'Chưa có'}
                      </strong>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500">Địa chỉ thường trú:</span>
                      <span className="text-gray-800 font-medium text-right max-w-[220px]">
                        {student.address || 'Chưa cập nhật'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status & Conduct */}
                <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-3">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-pink-600" />
                    <span>Học Lực & Hạnh Kiểm</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span className="text-gray-500">Điểm trung bình các môn:</span>
                      <span className="font-black text-pink-600 text-sm">
                        {avgGrade !== null ? avgGrade.toFixed(1) : 'Chưa có'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span className="text-gray-500">Xếp loại học lực:</span>
                      <span className="font-bold text-emerald-700">
                        {academicRank}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span className="text-gray-500">Đánh giá rèn luyện chính thức:</span>
                      <span className="font-bold text-emerald-700">
                        {student.officialConduct?.rating || 'Chờ GVCN xác nhận'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500">Điểm thi đua tích lũy:</span>
                      <span className="font-black text-emerald-600 text-sm">
                        {totalPoints >= 0 ? `+${totalPoints}` : totalPoints} điểm
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Special notes */}
              <div className="p-5 rounded-2xl bg-pink-50/40 border border-pink-100">
                <h4 className="text-xs font-bold text-pink-900 mb-1.5 flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span>Nhận xét chung của Giáo viên chủ nhiệm</span>
                </h4>
                <p className="text-xs text-gray-700 leading-relaxed italic">
                  "{student.notes ||
                    'Học sinh có ý thức tự giác, chấp hành tốt nội quy nhà trường và của lớp.'}"
                </p>
              </div>

              {isTeacher && (
                <div className="flex justify-end">
                  <button
                    onClick={() => onEditStudent(student)}
                    className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Chỉnh sửa thông tin học sinh</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GRADES (CHỈ ĐỌC CHO HỌC SINH, SỬA ĐƯỢC CHO GV) */}
          {activeTab === 'grades' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <div>
                  <h4 className="font-bold text-sm text-gray-900">
                    Bảng Điểm Học Tập Các Môn
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Hệ số 10. Điểm TB hiện tại:{' '}
                    <strong className="text-pink-600 font-black">
                      {avgGrade !== null ? avgGrade.toFixed(1) : 'Chưa có'}
                    </strong>{' '}
                    ({academicRank})
                  </p>
                </div>
                {isTeacher && (
                  <button
                    onClick={handleSaveGradesSubmit}
                    className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Lưu Bảng Điểm</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {SUBJECT_LIST.map((subject) => {
                  const currentScore = grades[subject];
                  return (
                    <div
                      key={subject}
                      className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80 flex items-center justify-between"
                    >
                      <span className="text-xs font-bold text-gray-700 truncate mr-2">
                        {subject}
                      </span>
                      {isTeacher ? (
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={currentScore !== undefined ? currentScore : ''}
                          onChange={(e) => {
                            const val =
                              e.target.value === ''
                                ? undefined
                                : parseFloat(e.target.value);
                            setGrades((prev) => {
                              const next = { ...prev };
                              if (val === undefined || isNaN(val)) {
                                delete next[subject];
                              } else {
                                next[subject] = Math.min(10, Math.max(0, val));
                              }
                              return next;
                            });
                          }}
                          placeholder="--"
                          className="w-16 px-2 py-1 bg-white border border-gray-300 rounded-lg text-center font-bold text-xs text-gray-900 focus:outline-hidden focus:ring-1 focus:ring-pink-500"
                        />
                      ) : (
                        <span
                          className={`font-black text-xs px-2.5 py-1 rounded-lg ${
                            currentScore !== undefined
                              ? currentScore >= 8.0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : currentScore >= 6.5
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-gray-100 text-gray-800'
                              : 'text-gray-400'
                          }`}
                        >
                          {currentScore !== undefined ? currentScore.toFixed(1) : '--'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: DISCIPLINE (THI ĐUA & KỶ LUẬT) */}
          {activeTab === 'discipline' && (
            <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 sm:gap-5 items-stretch overflow-hidden">
              {/* CỘT BÊN TRÁI: Ghi nhận sự việc (CHỈ HIỂN THỊ KHI LÀ GIÁO VIÊN) */}
              {isTeacher && (
                <div className="w-full md:w-[380px] lg:w-[420px] xl:w-[450px] shrink-0 bg-white rounded-2xl border border-pink-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-pink-100">
                      <div className="flex items-center gap-2 font-bold text-gray-900 text-sm sm:text-base">
                        <div className="w-7 h-7 rounded-xl bg-pink-100/80 text-pink-600 flex items-center justify-center shrink-0">
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </div>
                        <span>Ghi nhận sự việc</span>
                      </div>
                      <button
                        type="submit"
                        form="discipline-form"
                        className="text-xs font-bold text-pink-700 hover:text-white bg-pink-50 hover:bg-linear-to-r hover:from-pink-500 hover:to-rose-500 active:scale-95 px-3 py-1.5 rounded-xl border border-pink-300 shadow-2xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-1.5 group"
                        title="Bấm để lưu cập nhật nề nếp"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-pink-600 group-hover:text-white transition-colors" />
                        <span>Cập nhật nề nếp</span>
                      </button>
                    </div>

                    <form
                      id="discipline-form"
                      onSubmit={handleCreateDiscipline}
                      className="mt-3.5 space-y-3.5"
                    >
                      {/* 1. Ngày tháng */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-pink-500" />
                          <span>Ngày tháng</span>
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={disciplineDate}
                          onChange={(e) => setDisciplineDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-gray-50/70 focus:bg-white border border-gray-200 focus:border-pink-400 rounded-xl text-xs sm:text-sm font-semibold text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-pink-300/50 shadow-2xs transition-all"
                        />
                      </div>

                      {/* 2. Nội dung ghi nhận (Quy tắc thi đua) */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-pink-500" />
                          <span>Nội dung ghi nhận</span>
                          <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={selectedRuleIndex}
                          onChange={(e) =>
                            setSelectedRuleIndex(parseInt(e.target.value, 10))
                          }
                          className="w-full px-3 py-2.5 bg-gray-50/70 focus:bg-white border border-gray-200 focus:border-pink-400 rounded-xl text-xs sm:text-sm font-bold text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-pink-300/50 shadow-2xs transition-all cursor-pointer"
                        >
                          {rulesList.map((rule, idx) => (
                            <option key={rule.id || idx} value={idx}>
                              {rule.name} ({rule.points >= 0 ? `+${rule.points}` : rule.points}đ)
                            </option>
                          ))}
                        </select>
                      </div>

                      {rulesList[selectedRuleIndex]?.name === 'Khác' && (
                        <div className="space-y-2 p-3 bg-pink-50/50 rounded-xl border border-pink-100">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                              Tên sự việc khác *
                            </label>
                            <input
                              type="text"
                              value={customRuleName}
                              onChange={(e) => setCustomRuleName(e.target.value)}
                              placeholder="Nhập tên sự việc..."
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-800"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                              Số điểm (+ hoặc -) *
                            </label>
                            <input
                              type="number"
                              value={customPoints}
                              onChange={(e) =>
                                setCustomPoints(parseInt(e.target.value, 10) || 0)
                              }
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-800"
                            />
                          </div>
                        </div>
                      )}

                      {/* 3. Ghi chú */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                          <Edit2 className="w-3.5 h-3.5 text-pink-500" />
                          <span>Ghi chú</span>
                        </label>
                        <textarea
                          rows={3}
                          value={disciplineNote}
                          onChange={(e) => setDisciplineNote(e.target.value)}
                          placeholder="Ghi chú thêm chi tiết hoàn cảnh sự việc (tùy chọn)..."
                          className="w-full p-3 bg-gray-50/70 focus:bg-white border border-gray-200 focus:border-pink-400 rounded-xl text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-pink-300/50 shadow-2xs resize-none transition-all"
                        />
                      </div>
                    </form>
                  </div>

                  {/* 4. Nút Lưu ghi nhận sự việc */}
                  <div className="pt-3.5 border-t border-gray-100 mt-2">
                    <button
                      type="submit"
                      form="discipline-form"
                      className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-linear-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 active:scale-98 text-white shadow-md shadow-pink-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                      <span>Lưu ghi nhận sự việc</span>
                    </button>
                  </div>
                </div>
              )}

              {/* CỘT BÊN PHẢI (HOẶC TOÀN BỘ KHI LÀ HỌC SINH): Kỳ đánh giá & Lịch sử sự việc */}
              <div className="flex-1 min-w-0 flex flex-col gap-3 sm:gap-4 overflow-hidden">
                {/* 1. Thẻ Kỳ đánh giá (Tháng / Học kỳ / Cả năm), Điểm thi đua & Xếp loại gợi ý */}
                <div className="bg-linear-to-r from-gray-50 via-pink-50/30 to-gray-50 rounded-2xl border border-gray-200/90 p-3.5 sm:p-4 flex flex-col gap-3 shrink-0 shadow-2xs">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    {/* KỲ ĐÁNH GIÁ (DROPDOWN) */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                        KỲ ĐÁNH GIÁ
                      </label>
                      <select
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-800 shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-pink-400 cursor-pointer"
                      >
                        {periodOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* ĐIỂM THI ĐUA CÒN LẠI */}
                    <div className="text-right sm:text-center space-y-0.5">
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                        ĐIỂM THI ĐUA CÒN LẠI
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-gray-900 flex items-center justify-end sm:justify-center gap-1.5">
                        <span>{studentEmulation.finalTotalPoints}đ</span>
                        <span
                          className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                            periodNetPoints >= 0
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                          title={`Điểm chuẩn: ${studentEmulation.initialPoints}đ, Thưởng: +${periodBonusPoints}đ, Trừ: -${periodPenaltyPoints}đ`}
                        >
                          ({studentEmulation.initialPoints}
                          {periodBonusPoints > 0 ? ` +${periodBonusPoints}` : ' +0'}
                          {periodPenaltyPoints > 0 ? ` -${periodPenaltyPoints}` : ' -0'})
                        </span>
                      </div>
                    </div>

                    {/* XẾP LOẠI GỢI Ý THEO THI ĐUA */}
                    <div className="text-right space-y-0.5">
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                        Xếp loại gợi ý theo thi đua
                      </div>
                      <div>
                        <span
                          className={`inline-block px-3 py-1 rounded-xl text-xs sm:text-sm font-black border ${
                            studentEmulation.suggestedRating === 'Tốt'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : studentEmulation.suggestedRating === 'Khá'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : studentEmulation.suggestedRating === 'Đạt'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {studentEmulation.suggestedRating}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cảnh báo hạ bậc nếu vi phạm điều kiện bổ sung */}
                  {studentEmulation.isDowngraded &&
                    studentEmulation.downgradeReason && (
                      <div className="text-[11px] text-amber-800 bg-amber-50/90 border border-amber-200/90 rounded-xl px-3 py-1.5 flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>{studentEmulation.downgradeReason}</span>
                      </div>
                    )}

                  {/* Mục Kết quả đánh giá rèn luyện chính thức */}
                  <div className="pt-2.5 border-t border-gray-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-700">
                        Đánh giá rèn luyện chính thức:
                      </span>
                      {student.officialConduct ? (
                        <span
                          className={`px-2.5 py-0.5 rounded-lg font-black border text-xs ${
                            student.officialConduct.rating === 'Tốt'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : student.officialConduct.rating === 'Khá'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : student.officialConduct.rating === 'Đạt'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {student.officialConduct.rating}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">
                          Chưa xác nhận (chờ GVCN)
                        </span>
                      )}
                      {student.officialConduct?.reason && (
                        <span
                          className="text-gray-500 text-[11px] max-w-xs truncate"
                          title={student.officialConduct.reason}
                        >
                          - {student.officialConduct.reason}
                        </span>
                      )}
                    </div>

                    {isTeacher && (
                      <button
                        type="button"
                        onClick={() => {
                          setOfficialRating(
                            student.officialConduct?.rating ||
                              (studentEmulation.suggestedRating as ConductGrade)
                          );
                          setOfficialReason(student.officialConduct?.reason || '');
                          setIsOfficialModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold text-xs border border-pink-200/70 transition-all cursor-pointer self-start sm:self-auto flex items-center gap-1 active:scale-95"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {student.officialConduct
                            ? 'Điều chỉnh chính thức'
                            : 'Xác nhận chính thức'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Bảng Lịch sử sự việc - THANH CUỘN CHỈ Ở ĐÂY */}
                <div className="flex-1 min-h-0 bg-white rounded-2xl border border-gray-200/90 overflow-hidden shadow-2xs flex flex-col">
                  <div className="py-2.5 px-4 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-gray-500" />
                      <span className="text-xs sm:text-sm font-bold text-gray-800">
                        Lịch sử sự việc ({displayedDiscipline.length})
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400">
                      Cuộn danh sách tại đây
                    </span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar scroll-smooth">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead className="sticky top-0 bg-white z-10 border-b border-gray-200 text-gray-600 font-bold">
                        <tr>
                          <th className="py-2.5 px-4 w-28 sm:w-32">Ngày</th>
                          <th className="py-2.5 px-4">Nội dung sự việc</th>
                          <th className="py-2.5 px-4 w-24 sm:w-28 text-center">
                            Điểm
                          </th>
                          {isTeacher && (
                            <th className="py-2.5 px-4 w-14 text-center">Xóa</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-700">
                        {displayedDiscipline.length === 0 ? (
                          <tr>
                            <td
                              colSpan={isTeacher ? 4 : 3}
                              className="py-14 text-center text-gray-400"
                            >
                              Chưa có sự việc nào được ghi nhận trong kỳ đánh giá này.
                            </td>
                          </tr>
                        ) : (
                          displayedDiscipline.map((d) => (
                            <tr
                              key={d.id}
                              className="hover:bg-gray-50/70 transition-colors"
                            >
                              <td className="py-3 px-4 font-medium text-gray-600 whitespace-nowrap text-xs sm:text-sm">
                                {formatViDate(d.date)}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-gray-900 text-xs sm:text-sm">
                                  {d.ruleName}
                                </div>
                                {d.note && (
                                  <div className="text-xs text-gray-500 mt-0.5 font-normal">
                                    {d.note}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`font-black text-xs sm:text-sm ${
                                    d.points < 0
                                      ? 'text-red-600'
                                      : 'text-emerald-600'
                                  }`}
                                >
                                  {d.points > 0 ? `+${d.points}` : d.points}
                                </span>
                              </td>
                              {isTeacher && (
                                <td className="py-3 px-4 text-center">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      onDeleteDiscipline(d.id);
                                    }}
                                    className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 active:scale-90 transition-all cursor-pointer inline-flex items-center justify-center group"
                                    title={`Xóa sự việc "${d.ruleName}"`}
                                  >
                                    <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ATTENDANCE (CHỈ ĐỌC) */}
          {activeTab === 'attendance' && (
            <div className="space-y-5">
              <h4 className="font-bold text-sm text-gray-900 pb-3 border-b border-gray-200">
                Thống Kê Chuyên Cần Cá Nhân
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="text-xl font-black text-emerald-800">
                    {countPresent}
                  </div>
                  <div className="text-xs font-bold text-emerald-700">Có mặt</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                  <div className="text-xl font-black text-amber-800">
                    {countExcused}
                  </div>
                  <div className="text-xs font-bold text-amber-700">
                    Vắng có phép
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200">
                  <div className="text-xl font-black text-blue-800">
                    {countLate}
                  </div>
                  <div className="text-xs font-bold text-blue-700">
                    Đi học muộn
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200">
                  <div className="text-xl font-black text-rose-800">
                    {countUnexcused}
                  </div>
                  <div className="text-xs font-bold text-rose-700">Không phép</div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h5 className="text-xs font-bold text-gray-600 uppercase">
                  Lịch Sử Điểm Danh:
                </h5>
                {personalAttendance.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">
                    Chưa có dữ liệu điểm danh.
                  </p>
                ) : (
                  personalAttendance.map((a) => {
                    const meta = STATUS_META[a.status];
                    return (
                      <div
                        key={a.id}
                        className="p-3 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold text-gray-700">
                          {formatViDate(a.date)}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold border ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 5: NOTES (GV ONLY) */}
          {activeTab === 'notes' && isTeacher && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <h4 className="font-bold text-sm text-gray-900">
                  Sổ Tay Dặn Dò & Ghi Chú Riêng
                </h4>
                <button
                  onClick={() => setIsAddingNote(!isAddingNote)}
                  className="px-3 py-1.5 bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{isAddingNote ? 'Đóng lại' : 'Thêm ghi chú'}</span>
                </button>
              </div>

              {isAddingNote && (
                <form
                  onSubmit={handleCreateNote}
                  className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3"
                >
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Tiêu đề ghi chú
                    </label>
                    <input
                      type="text"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="Ví dụ: Nhắc nhở nộp bài tập..."
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Nội dung chi tiết *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Ghi chú nội dung cần trao đổi..."
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingNote(false)}
                      className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl shadow-xs"
                    >
                      Lưu ghi chú
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {personalNotes.length === 0 ? (
                  <p className="text-xs text-gray-400 py-6 text-center">
                    Chưa có ghi chú hoặc dặn dò nào.
                  </p>
                ) : (
                  personalNotes.map((n) => (
                    <div
                      key={n.id}
                      className="p-4 rounded-2xl bg-white border border-gray-200 space-y-1 relative group"
                    >
                      <div className="flex items-start justify-between">
                        <h5 className="font-bold text-xs text-gray-900">
                          {n.title}
                        </h5>
                        <button
                          onClick={() => onDeleteNote(n.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 rounded transition-all"
                          title="Xóa ghi chú"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
                        {n.content}
                      </p>
                      <div className="pt-2 text-[10px] text-gray-400 flex items-center gap-2">
                        <span>{n.date}</span>
                        <span>•</span>
                        <span>Người ghi: {n.author}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 6: PASSWORD (GV ONLY) */}
          {activeTab === 'password' && isTeacher && (
            <div className="space-y-5 max-w-md">
              <h4 className="font-bold text-sm text-gray-900 pb-3 border-b border-gray-200">
                Đặt Lại Mật Khẩu Đăng Nhập Cho Học Sinh
              </h4>
              <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Mật khẩu mới cho học sinh *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới hoặc ngày sinh dạng ddmmyyyy..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-pink-500"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Mật khẩu mặc định hệ thống khuyên dùng: 8 chữ số ngày sinh dạng <strong>ddmmyyyy</strong> (hoặc có tiền tố MS).
                  </p>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  Cập nhật mật khẩu
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Official Conduct Modal (Teacher only) */}
      {isOfficialModalOpen && isTeacher && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-linear-to-r from-pink-600 to-rose-600 text-white">
              <h3 className="font-bold text-sm sm:text-base">
                Xác Nhận Đánh Giá Rèn Luyện Chính Thức
              </h3>
              <button
                onClick={() => setIsOfficialModalOpen(false)}
                className="text-pink-200 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleConfirmOfficialConduct}
              className="p-5 sm:p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Mức Xếp Loại Chính Thức *
                </label>
                <select
                  value={officialRating}
                  onChange={(e) =>
                    setOfficialRating(e.target.value as ConductGrade)
                  }
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-pink-500 cursor-pointer"
                >
                  <option value="Tốt">Tốt</option>
                  <option value="Khá">Khá</option>
                  <option value="Đạt">Đạt</option>
                  <option value="Chưa đạt">Chưa đạt</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Xếp loại gợi ý theo thi đua hiện tại:{' '}
                  <strong>{studentEmulation.suggestedRating}</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Lý Do / Căn Cứ Điều Chỉnh (Nếu có)
                </label>
                <textarea
                  rows={3}
                  value={officialReason}
                  onChange={(e) => setOfficialReason(e.target.value)}
                  placeholder="Nhập lý do điều chỉnh hoặc căn cứ đánh giá của GVCN..."
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-pink-500 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsOfficialModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 font-bold text-xs hover:bg-gray-50 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs shadow-md shadow-pink-600/20 cursor-pointer"
                >
                  Lưu Đánh Giá Chính Thức
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

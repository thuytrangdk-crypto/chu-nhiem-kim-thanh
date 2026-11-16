import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  AppState,
  ConductGrade,
  DisciplineRecord,
  NoteRecord,
  SemesterFilter,
  SemesterId,
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
  AlertTriangle,
  Star,
  Edit2,
  History,
  FileSpreadsheet,
} from 'lucide-react';
import {
  calculateAverageGrade,
  formatViDate,
  getConductFromGrade,
  getTodayStr,
  STATUS_META,
  SUBJECT_LIST,
} from '../utils/helpers';
import { DEFAULT_DISCIPLINE_RULES } from '../defaultData';
import {
  getEmulationConfigForClass,
} from '../utils/emulationEvaluation';
import {
  detectSemesterAndYearForDate,
  evaluateSemesterEmulation,
  filterRecordsForSemester,
  getActiveSemesterForDate,
  getAllAvailableSchoolYears,
  getMonthsInSemesterRange,
  getOfficialConductForSemester,
  getOfficialConductKey,
  getRecordScope,
  getSemesterConfigForYear,
  getSemesterLabel,
  getSemesterShortLabel,
  getSuggestedRatingBadgeClass,
  inferNaturalSchoolYearFromDate,
  normalizeSchoolYear,
} from '../utils/semesterUtils';
import { exportStudentViolationsToExcel } from '../utils/studentViolationExport';

interface StudentProfileModalProps {
  studentId: string;
  state: AppState;
  isTeacher: boolean;
  onClose: () => void;
  onEditStudent: (s: Student) => void;
  onSaveStudentUpdate?: (s: Student) => void;
  onUpdateAvatar: (studentId: string, base64: string) => void;
  onSaveGrades: (studentId: string, grades: Record<string, number>) => void;
  onAddDiscipline: (record: Omit<DisciplineRecord, 'id'>) => void;
  onUpdateDiscipline?: (record: DisciplineRecord) => void;
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
  onSaveStudentUpdate,
  onUpdateAvatar,
  onSaveGrades,
  onAddDiscipline,
  onUpdateDiscipline,
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

  const todayStr = getTodayStr();
  const defaultSchoolYear = normalizeSchoolYear(
    state.config.schoolYear || inferNaturalSchoolYearFromDate(todayStr)
  );
  const ongoingSemester = getActiveSemesterForDate(
    todayStr,
    state.semesterConfigs,
    defaultSchoolYear
  );

  // Discipline record form state (Teacher only - supports Add & Edit)
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [disciplineDate, setDisciplineDate] = useState<string>(todayStr);
  const [selectedRuleIndex, setSelectedRuleIndex] = useState<number>(0);
  const [customRuleName, setCustomRuleName] = useState<string>('');
  const [customPoints, setCustomPoints] = useState<number>(-2);
  const [disciplineNote, setDisciplineNote] = useState<string>('');
  const [outOfRangeSemesterOverride, setOutOfRangeSemesterOverride] =
    useState<SemesterId | ''>('');

  // Selected evaluation period filters: Năm học + Học kỳ ('hk1' | 'hk2' | 'all') + Tháng ('all' | 'YYYY-MM')
  const [selectedSchoolYear, setSelectedSchoolYear] =
    useState<string>(defaultSchoolYear);
  const [selectedSemesterFilter, setSelectedSemesterFilter] =
    useState<SemesterFilter>(ongoingSemester);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');

  // Note form state (Teacher only)
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // Password state (Teacher only)
  const [newPassword, setNewPassword] = useState('');

  if (!student) return null;

  // Personal discipline records
  const personalDiscipline = useMemo(
    () => state.discipline.filter((d) => d.studentId === student.id),
    [state.discipline, student.id]
  );

  // Available school years & configured semester schedule for selected school year
  const availableSchoolYears = useMemo(
    () => getAllAvailableSchoolYears(state, todayStr),
    [state, todayStr]
  );

  const selectedYearSchedule = useMemo(
    () => getSemesterConfigForYear(state.semesterConfigs, selectedSchoolYear),
    [state.semesterConfigs, selectedSchoolYear]
  );

  const availableMonthsInScope = useMemo(
    () => getMonthsInSemesterRange(selectedYearSchedule, selectedSemesterFilter),
    [selectedYearSchedule, selectedSemesterFilter]
  );

  // Reset month filter if switching year/semester and old month isn't in new scope
  useEffect(() => {
    if (
      selectedMonthFilter !== 'all' &&
      !availableMonthsInScope.some((m) => m.value === selectedMonthFilter)
    ) {
      setSelectedMonthFilter('all');
    }
  }, [availableMonthsInScope, selectedMonthFilter]);

  // Active emulation config for current class & selected year
  const activeEmulationConfig = useMemo(() => {
    return getEmulationConfigForClass(
      state.classEmulationConfigs,
      state.emulationConfig,
      state.config.className,
      selectedSchoolYear
    );
  }, [
    state.classEmulationConfigs,
    state.emulationConfig,
    state.config.className,
    selectedSchoolYear,
  ]);

  // Ongoing semester evaluation (for Top Header Stat Pill & Tab 1 overview - always 200pt base)
  const ongoingSemesterEval = useMemo(() => {
    return evaluateSemesterEmulation(
      student.id,
      state.discipline,
      defaultSchoolYear,
      ongoingSemester,
      state.semesterConfigs,
      getEmulationConfigForClass(
        state.classEmulationConfigs,
        state.emulationConfig,
        state.config.className,
        defaultSchoolYear
      ),
      state.config.schoolYear
    );
  }, [
    student.id,
    state.discipline,
    defaultSchoolYear,
    ongoingSemester,
    state.semesterConfigs,
    state.classEmulationConfigs,
    state.emulationConfig,
    state.config.className,
    state.config.schoolYear,
  ]);

  // Independent HK I & HK II evaluations for selectedSchoolYear (NEVER merged or summed to 400!)
  const hk1Emulation = useMemo(() => {
    return evaluateSemesterEmulation(
      student.id,
      state.discipline,
      selectedSchoolYear,
      'hk1',
      state.semesterConfigs,
      activeEmulationConfig,
      state.config.schoolYear,
      selectedSemesterFilter === 'hk1' ? selectedMonthFilter : undefined
    );
  }, [
    student.id,
    state.discipline,
    selectedSchoolYear,
    state.semesterConfigs,
    activeEmulationConfig,
    state.config.schoolYear,
    selectedSemesterFilter,
    selectedMonthFilter,
  ]);

  const hk2Emulation = useMemo(() => {
    return evaluateSemesterEmulation(
      student.id,
      state.discipline,
      selectedSchoolYear,
      'hk2',
      state.semesterConfigs,
      activeEmulationConfig,
      state.config.schoolYear,
      selectedSemesterFilter === 'hk2' ? selectedMonthFilter : undefined
    );
  }, [
    student.id,
    state.discipline,
    selectedSchoolYear,
    state.semesterConfigs,
    activeEmulationConfig,
    state.config.schoolYear,
    selectedSemesterFilter,
    selectedMonthFilter,
  ]);

  const currentSemesterEval =
    selectedSemesterFilter === 'hk2' ? hk2Emulation : hk1Emulation;

  const hk1Official = getOfficialConductForSemester(student, selectedSchoolYear, 'hk1');
  const hk2Official = getOfficialConductForSemester(student, selectedSchoolYear, 'hk2');
  const ongoingOfficial = getOfficialConductForSemester(
    student,
    defaultSchoolYear,
    ongoingSemester
  );
  const activeSemesterOfficial =
    selectedSemesterFilter === 'hk2' ? hk2Official : hk1Official;

  // Filter discipline records strictly by selectedSchoolYear + selectedSemesterFilter + optional month
  const displayedDiscipline = useMemo(() => {
    let filtered: DisciplineRecord[] = [];
    if (selectedSemesterFilter === 'all') {
      const hk1List = filterRecordsForSemester(
        personalDiscipline,
        selectedSchoolYear,
        'hk1',
        state.semesterConfigs,
        state.config.schoolYear
      );
      const hk2List = filterRecordsForSemester(
        personalDiscipline,
        selectedSchoolYear,
        'hk2',
        state.semesterConfigs,
        state.config.schoolYear
      );
      filtered = [...hk1List, ...hk2List];
    } else {
      filtered = filterRecordsForSemester(
        personalDiscipline,
        selectedSchoolYear,
        selectedSemesterFilter,
        state.semesterConfigs,
        state.config.schoolYear,
        selectedMonthFilter
      );
    }
    return [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [
    personalDiscipline,
    selectedSchoolYear,
    selectedSemesterFilter,
    selectedMonthFilter,
    state.semesterConfigs,
    state.config.schoolYear,
  ]);

  // Detect semester & year for the date currently typed in the Add/Edit form
  const formDateDetection = useMemo(() => {
    return detectSemesterAndYearForDate(
      disciplineDate || todayStr,
      state.semesterConfigs,
      selectedSchoolYear
    );
  }, [disciplineDate, todayStr, state.semesterConfigs, selectedSchoolYear]);

  // Export violation Excel report state & logic
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const periodBadgeLabel = useMemo(() => {
    if (selectedSemesterFilter === 'all') return 'Cả năm';
    if (selectedMonthFilter !== 'all' && selectedMonthFilter.startsWith('20')) {
      const parts = selectedMonthFilter.split('-');
      return `T${parseInt(parts[1], 10)}/${parts[0].slice(2)}`;
    }
    return selectedSemesterFilter === 'hk1' ? 'HK I' : 'HK II';
  }, [selectedSemesterFilter, selectedMonthFilter]);

  const handleExportViolationExcel = async () => {
    if (!student) return;
    try {
      setIsExportingExcel(true);
      let periodLabel = '';
      if (selectedSemesterFilter === 'all') {
        periodLabel = `Cả năm học ${selectedSchoolYear} (HK I & HK II tách riêng)`;
      } else if (selectedMonthFilter !== 'all') {
        const [y, m] = selectedMonthFilter.split('-');
        periodLabel = `Tháng ${parseInt(m, 10)}/${y} (${getSemesterLabel(
          selectedSemesterFilter
        )} - ${selectedSchoolYear})`;
      } else {
        periodLabel = `${getSemesterLabel(
          selectedSemesterFilter
        )} - Năm học ${selectedSchoolYear}`;
      }

      const res = await exportStudentViolationsToExcel({
        student,
        className: state.config.className || '6A8',
        schoolName: state.config.schoolName || 'Trường THCS Nguyễn Huệ',
        schoolYear: selectedSchoolYear,
        teacherName: state.config.teacherName || 'Cô Lê Thị Kim Thanh',
        selectedPeriod:
          selectedSemesterFilter === 'all'
            ? 'year'
            : selectedMonthFilter !== 'all'
            ? selectedMonthFilter
            : selectedSemesterFilter,
        periodLabel,
        records: displayedDiscipline,
        basePoints: currentSemesterEval.initialPoints,
        finalPoints: currentSemesterEval.finalTotalPoints,
        suggestedRating: currentSemesterEval.suggestedRating,
        semesterConfigs: state.semesterConfigs,
        hk1Summary:
          selectedSemesterFilter === 'all'
            ? {
                basePoints: hk1Emulation.initialPoints,
                finalPoints: hk1Emulation.finalTotalPoints,
                suggestedRating: hk1Emulation.suggestedRating,
              }
            : undefined,
        hk2Summary:
          selectedSemesterFilter === 'all'
            ? {
                basePoints: hk2Emulation.initialPoints,
                finalPoints: hk2Emulation.finalTotalPoints,
                suggestedRating: hk2Emulation.suggestedRating,
              }
            : undefined,
      });

      if (res.success) {
        onShowToast(
          res.totalViolations > 0
            ? `Đã xuất file Excel: ${res.fileName} (${res.totalViolations} lỗi vi phạm)`
            : `Đã xuất file Excel: ${res.fileName} (Không có vi phạm)`
        );
      }
    } catch (err: any) {
      console.error('Lỗi xuất Excel vi phạm:', err);
      onShowToast('Có lỗi xảy ra khi tạo tệp Excel vi phạm', 'error');
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Official conduct evaluation modal & form state (Teacher only - per semester!)
  const [isOfficialModalOpen, setIsOfficialModalOpen] = useState(false);
  const [officialTargetSemester, setOfficialTargetSemester] =
    useState<SemesterId>('hk1');
  const [officialRating, setOfficialRating] = useState<ConductGrade>('Tốt');
  const [officialReason, setOfficialReason] = useState('');

  const openOfficialModalForSemester = (sem: SemesterId) => {
    const existing = getOfficialConductForSemester(student, selectedSchoolYear, sem);
    const suggested =
      sem === 'hk2' ? hk2Emulation.suggestedRating : hk1Emulation.suggestedRating;
    setOfficialTargetSemester(sem);
    setOfficialRating(existing?.rating || suggested);
    setOfficialReason(existing?.reason || '');
    setIsOfficialModalOpen(true);
  };

  const handleConfirmOfficialConduct = (e: React.FormEvent) => {
    e.preventDefault();
    const key = getOfficialConductKey(selectedSchoolYear, officialTargetSemester);
    const evaluation = {
      rating: officialRating,
      reason: officialReason.trim() || undefined,
      confirmedBy: state.config.teacherName || 'GVCN',
      confirmedAt: new Date().toLocaleString('vi-VN'),
    };
    const updatedStudent: Student = {
      ...student,
      officialConduct:
        officialTargetSemester === ongoingSemester &&
        selectedSchoolYear === defaultSchoolYear
          ? evaluation
          : student.officialConduct,
      officialConductByPeriod: {
        ...(student.officialConductByPeriod || {}),
        [key]: evaluation,
      },
    };
    if (onSaveStudentUpdate) {
      onSaveStudentUpdate(updatedStudent);
    } else {
      onEditStudent(updatedStudent);
    }
    setIsOfficialModalOpen(false);
    onShowToast(
      `Đã xác nhận đánh giá rèn luyện chính thức ${getSemesterLabel(
        officialTargetSemester
      )} (${selectedSchoolYear}): ${officialRating}!`
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

  const handleStartEditDiscipline = (rec: DisciplineRecord) => {
    setEditingRecordId(rec.id);
    setDisciplineDate(rec.date || todayStr);
    setDisciplineNote(rec.note || '');
    setOutOfRangeSemesterOverride('');
    const matchedIdx = rulesList.findIndex(
      (r) => r.name === rec.ruleName && r.points === rec.points
    );
    if (matchedIdx !== -1 && rulesList[matchedIdx].name !== 'Khác') {
      setSelectedRuleIndex(matchedIdx);
      setCustomRuleName('');
    } else {
      const otherIdx = rulesList.findIndex((r) => r.name === 'Khác');
      setSelectedRuleIndex(otherIdx !== -1 ? otherIdx : 0);
      setCustomRuleName(rec.ruleName);
      setCustomPoints(rec.points);
    }
  };

  const handleCancelEditDiscipline = () => {
    setEditingRecordId(null);
    setDisciplineDate(todayStr);
    setSelectedRuleIndex(0);
    setCustomRuleName('');
    setCustomPoints(-2);
    setDisciplineNote('');
    setOutOfRangeSemesterOverride('');
  };

  const handleCreateOrUpdateDiscipline = (e: React.FormEvent) => {
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

    const targetDate = disciplineDate || todayStr;
    const detected = detectSemesterAndYearForDate(
      targetDate,
      state.semesterConfigs,
      selectedSchoolYear
    );

    const assignedSchoolYear = detected.isWithinConfiguredRange
      ? detected.schoolYear
      : selectedSchoolYear;
    const assignedSemester: SemesterId = detected.isWithinConfiguredRange
      ? detected.semester
      : outOfRangeSemesterOverride || detected.semester;

    if (editingRecordId && onUpdateDiscipline) {
      const existing = personalDiscipline.find((r) => r.id === editingRecordId);
      onUpdateDiscipline({
        ...(existing || { id: editingRecordId, studentId: student.id }),
        id: editingRecordId,
        studentId: student.id,
        date: targetDate,
        ruleName: finalRuleName,
        points: finalPoints,
        note: disciplineNote.trim(),
        type: finalType,
        schoolYear: assignedSchoolYear,
        semester: assignedSemester,
      });
      handleCancelEditDiscipline();
    } else {
      onAddDiscipline({
        studentId: student.id,
        date: targetDate,
        ruleName: finalRuleName,
        points: finalPoints,
        note: disciplineNote.trim(),
        type: finalType,
        schoolYear: assignedSchoolYear,
        semester: assignedSemester,
      });
      setDisciplineNote('');
      setCustomRuleName('');
      setOutOfRangeSemesterOverride('');
      if (!detected.isWithinConfiguredRange) {
        onShowToast(
          `Đã lưu vào ${getSemesterLabel(
            assignedSemester
          )} (${assignedSchoolYear}) dù ngày nằm ngoài lịch học kỳ`
        );
      }
    }
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
        className="w-[98vw] max-w-7xl h-[94vh] max-h-[96vh] bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#E5B2BD] flex flex-col cursor-default relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút đóng duy nhất ở góc trên bên phải */}
        <button
          onClick={onClose}
          aria-label="Đóng"
          title="Đóng (Phím ESC)"
          className="absolute top-2.5 right-3 z-30 p-2 rounded-full bg-white/90 hover:bg-[#FCF4F6] text-gray-500 hover:text-gray-900 border border-[#EDB5C1]/50 shadow-2xs transition-all cursor-pointer"
        >
          <X className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Modal Top Header with Student Info (Màu hồng pastel #EDB5C1 thanh lịch) */}
        <div className="bg-linear-to-r from-[#FCF4F6] via-[#FAF0F3] to-[#F8E2E7] px-4 sm:px-6 pt-2.5 pb-0 shrink-0 border-b border-[#E5B2BD]">
          <div className="flex items-center justify-between gap-3 pr-10">
            {/* Student info inline */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              {/* Avatar nhỏ gọn */}
              <div className="relative group shrink-0">
                {student.avatar ? (
                  <img
                    src={student.avatar}
                    alt={student.name}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-cover ring-2 ring-[#EDB5C1]/60 shadow-2xs"
                  />
                ) : (
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#EDB5C1] flex items-center justify-center font-black text-sm sm:text-base text-[#1E293B] shadow-2xs ring-2 ring-[#EDB5C1]/60">
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
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FCF4F6] text-[#1E293B] border border-[#EDB5C1]">
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
                        <strong className="text-[#1E293B] font-semibold">
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
              <div className="px-2.5 py-1 rounded-xl bg-[#FCF4F6] border border-[#EDB5C1] flex items-center gap-1 text-[11px]">
                <span className="text-gray-500 font-medium">Chuyên cần:</span>
                <span className="font-black text-[#1E293B]">
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
                <span className="text-gray-500 font-medium">
                  Nề nếp ({getSemesterShortLabel(ongoingSemester)}):
                </span>
                <span className="font-black text-emerald-700">
                  {ongoingSemesterEval.finalTotalPoints}/{ongoingSemesterEval.initialPoints}đ
                </span>
              </div>
              <div className="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center gap-1 text-[11px]">
                <span className="text-gray-500 font-medium">Hạnh kiểm:</span>
                <span className="font-black text-amber-700">
                  {ongoingOfficial?.rating ||
                    ongoingSemesterEval.suggestedRating ||
                    'Tốt'}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs (Thiết kế thanh tab gọn gàng ngay bên dưới) */}
          <div className="flex items-center gap-1 sm:gap-4 overflow-x-auto custom-scrollbar border-t border-[#EDB5C1]/50 mt-1.5">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 py-1.5 px-1.5 text-xs sm:text-[13px] font-semibold transition-all whitespace-nowrap cursor-pointer relative ${
                    isActive
                      ? 'text-[#1E293B] font-black'
                      : 'text-gray-500 hover:text-[#1E293B]'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? 'text-[#1E293B]' : 'text-gray-400'
                    }`}
                  />
                  <span>{tab.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#EDB5C1] rounded-full" />
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
                    <User className="w-4 h-4 text-[#1E293B]" />
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
                      <strong className="text-[#1E293B] font-bold">
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
                    <GraduationCap className="w-4 h-4 text-[#1E293B]" />
                    <span>Học Lực & Hạnh Kiểm</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-gray-200/60">
                      <span className="text-gray-500">Điểm trung bình các môn:</span>
                      <span className="font-black text-[#1E293B] text-sm">
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
                      <span className="text-gray-500">
                        Đánh giá rèn luyện chính thức ({getSemesterShortLabel(ongoingSemester)}):
                      </span>
                      <span className="font-bold text-emerald-700">
                        {ongoingOfficial?.rating || 'Chờ GVCN xác nhận'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500">
                        Điểm thi đua {getSemesterLabel(ongoingSemester)}:
                      </span>
                      <span className="font-black text-emerald-600 text-sm">
                        {ongoingSemesterEval.finalTotalPoints} / {ongoingSemesterEval.initialPoints} điểm
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Special notes */}
              <div className="p-5 rounded-2xl bg-[#FCF4F6] border border-[#EDB5C1]">
                <h4 className="text-xs font-bold text-[#1E293B] mb-1.5 flex items-center gap-1.5">
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
                    className="px-4 py-2 bg-[#EDB5C1] hover:bg-[#E4A7B4] text-[#1E293B] font-black text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
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
                    <strong className="text-[#1E293B] font-black">
                      {avgGrade !== null ? avgGrade.toFixed(1) : 'Chưa có'}
                    </strong>{' '}
                    ({academicRank})
                  </p>
                </div>
                {isTeacher && (
                  <button
                    onClick={handleSaveGradesSubmit}
                    className="px-4 py-2 bg-[#EDB5C1] hover:bg-[#E4A7B4] text-[#1E293B] font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
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
                          className="w-16 px-2 py-1 bg-white border border-gray-300 rounded-lg text-center font-bold text-xs text-gray-900 focus:outline-hidden focus:ring-1 focus:ring-[#EDB5C1]"
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

          {/* TAB 3: DISCIPLINE (THI ĐUA & KỶ LUẬT THEO HỌC KỲ) */}
          {activeTab === 'discipline' && (
            <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 sm:gap-5 items-stretch overflow-hidden">
              {/* CỘT BÊN TRÁI: Ghi nhận / Chỉnh sửa sự việc (CHỈ HIỂN THỊ KHI LÀ GIÁO VIÊN) */}
              {isTeacher && (
                <div className="w-full md:w-[370px] lg:w-[410px] xl:w-[440px] shrink-0 bg-white rounded-2xl border border-[#EDB5C1]/70 p-4 sm:p-5 shadow-xs flex flex-col justify-between overflow-y-auto custom-scrollbar">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-[#EDB5C1]/30">
                      <div className="flex items-center gap-2 font-bold text-gray-900 text-sm sm:text-base">
                        <div className="w-7 h-7 rounded-xl bg-[#FCF4F6] text-[#1E293B] border border-[#EDB5C1] flex items-center justify-center shrink-0">
                          {editingRecordId ? (
                            <Edit2 className="w-3.5 h-3.5 stroke-[2.5]" />
                          ) : (
                            <Plus className="w-4 h-4 stroke-[2.5]" />
                          )}
                        </div>
                        <span>
                          {editingRecordId ? 'Chỉnh sửa sự việc' : 'Ghi nhận sự việc'}
                        </span>
                      </div>
                      {editingRecordId ? (
                        <button
                          type="button"
                          onClick={handleCancelEditDiscipline}
                          className="text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
                        >
                          Hủy sửa
                        </button>
                      ) : (
                        <button
                          type="submit"
                          form="discipline-form"
                          className="text-xs font-bold text-[#1E293B] bg-[#FCF4F6] hover:bg-[#EDB5C1] active:scale-95 px-3 py-1.5 rounded-xl border border-[#EDB5C1] shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center gap-1.5 group"
                          title="Bấm để lưu cập nhật nề nếp"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#1E293B]" />
                          <span>Cập nhật nề nếp</span>
                        </button>
                      )}
                    </div>

                    <form
                      id="discipline-form"
                      onSubmit={handleCreateOrUpdateDiscipline}
                      className="mt-3.5 space-y-3"
                    >
                      {/* 1. Ngày tháng + tự nhận diện học kỳ */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between gap-1.5">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[#C98292]" />
                            <span>Ngày tháng</span>
                            <span className="text-red-500">*</span>
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              formDateDetection.isWithinConfiguredRange
                                ? 'bg-[#FCF4F6] text-[#1E293B] border-[#EDB5C1]'
                                : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}
                          >
                            {getSemesterShortLabel(
                              formDateDetection.isWithinConfiguredRange
                                ? formDateDetection.semester
                                : outOfRangeSemesterOverride || formDateDetection.semester
                            )}{' '}
                            •{' '}
                            {formDateDetection.isWithinConfiguredRange
                              ? formDateDetection.schoolYear
                              : selectedSchoolYear}
                          </span>
                        </label>
                        <input
                          type="date"
                          required
                          value={disciplineDate}
                          onChange={(e) => {
                            setDisciplineDate(e.target.value);
                            setOutOfRangeSemesterOverride('');
                          }}
                          className="w-full px-3.5 py-2.5 bg-gray-50/70 focus:bg-white border border-gray-200 focus:border-[#EDB5C1] rounded-xl text-xs sm:text-sm font-semibold text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]/50 shadow-2xs transition-all"
                        />

                        {/* Cảnh báo nếu ngày sự việc nằm ngoài khoảng thời gian HK I & HK II đã cấu hình */}
                        {!formDateDetection.isWithinConfiguredRange && (
                          <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1.5">
                            <div className="flex items-start gap-1.5 font-bold">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <span>
                                Ngày {formatViDate(disciplineDate)} nằm ngoài lịch Học kỳ I (
                                {formatViDate(formDateDetection.matchedConfig.hk1Start)}–
                                {formatViDate(formDateDetection.matchedConfig.hk1End)}) và Học kỳ II (
                                {formatViDate(formDateDetection.matchedConfig.hk2Start)}–
                                {formatViDate(formDateDetection.matchedConfig.hk2End)}).
                              </span>
                            </div>
                            <div className="flex items-center gap-2 pl-5">
                              <span className="text-[10px] font-semibold text-amber-800">
                                Ghi nhận vào:
                              </span>
                              <select
                                value={
                                  outOfRangeSemesterOverride || formDateDetection.semester
                                }
                                onChange={(e) =>
                                  setOutOfRangeSemesterOverride(e.target.value as SemesterId)
                                }
                                className="px-2 py-0.5 bg-white border border-amber-300 rounded-lg text-[11px] font-bold text-amber-950 cursor-pointer"
                              >
                                <option value="hk1">Học kỳ I ({selectedSchoolYear})</option>
                                <option value="hk2">Học kỳ II ({selectedSchoolYear})</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. Nội dung ghi nhận (Quy tắc thi đua) */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-[#C98292]" />
                          <span>Nội dung ghi nhận</span>
                          <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={selectedRuleIndex}
                          onChange={(e) =>
                            setSelectedRuleIndex(parseInt(e.target.value, 10))
                          }
                          className="w-full px-3 py-2.5 bg-gray-50/70 focus:bg-white border border-gray-200 focus:border-[#EDB5C1] rounded-xl text-xs sm:text-sm font-bold text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]/50 shadow-2xs transition-all cursor-pointer"
                        >
                          {rulesList.map((rule, idx) => (
                            <option key={rule.id || idx} value={idx}>
                              {rule.name} ({rule.points >= 0 ? `+${rule.points}` : rule.points}đ)
                            </option>
                          ))}
                        </select>
                      </div>

                      {rulesList[selectedRuleIndex]?.name === 'Khác' && (
                        <div className="space-y-2 p-3 bg-[#FCF4F6] rounded-xl border border-[#EDB5C1]">
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
                          <Edit2 className="w-3.5 h-3.5 text-[#C98292]" />
                          <span>Ghi chú</span>
                        </label>
                        <textarea
                          rows={2}
                          value={disciplineNote}
                          onChange={(e) => setDisciplineNote(e.target.value)}
                          placeholder="Ghi chú thêm chi tiết hoàn cảnh sự việc (tùy chọn)..."
                          className="w-full p-2.5 bg-gray-50/70 focus:bg-white border border-gray-200 focus:border-[#EDB5C1] rounded-xl text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]/50 shadow-2xs resize-none transition-all"
                        />
                      </div>
                    </form>
                  </div>

                  {/* 4. Nút Lưu ghi nhận / Lưu chỉnh sửa */}
                  <div className="pt-3 border-t border-gray-100 mt-2">
                    <button
                      type="submit"
                      form="discipline-form"
                      className="w-full py-2.5 px-4 rounded-xl font-black text-xs sm:text-sm bg-[#EDB5C1] hover:bg-[#E4A7B4] active:scale-98 text-[#1E293B] shadow-md shadow-[#EDB5C1]/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                      <span>
                        {editingRecordId ? 'Lưu chỉnh sửa sự việc' : 'Lưu ghi nhận sự việc'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* CỘT BÊN PHẢI (HOẶC TOÀN BỘ KHI LÀ HỌC SINH): Kỳ đánh giá theo Học kỳ & Lịch sử sự việc */}
              <div className="flex-1 min-w-0 flex flex-col gap-3 sm:gap-3.5 overflow-hidden">
                {/* 1. Thẻ Kỳ đánh giá (Năm học / Học kỳ I / Học kỳ II / Cả năm), Điểm thi đua & Xếp loại gợi ý */}
                <div className="bg-linear-to-r from-gray-50 via-[#FCF4F6] to-gray-50 rounded-2xl border border-gray-200/90 p-3.5 sm:p-4 flex flex-col gap-3 shrink-0 shadow-2xs">
                  {/* Thanh bộ lọc Năm học + Học kỳ + Tháng + Xuất Excel */}
                  <div className="flex items-end justify-between gap-2.5 flex-wrap">
                    <div className="flex items-end gap-2 flex-wrap">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                          NĂM HỌC
                        </label>
                        <select
                          value={selectedSchoolYear}
                          onChange={(e) => setSelectedSchoolYear(e.target.value)}
                          className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] cursor-pointer"
                        >
                          {availableSchoolYears.map((yr) => (
                            <option key={yr} value={yr}>
                              {yr}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                          HỌC KỲ
                        </label>
                        <select
                          value={selectedSemesterFilter}
                          onChange={(e) =>
                            setSelectedSemesterFilter(e.target.value as SemesterFilter)
                          }
                          className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] cursor-pointer"
                        >
                          <option value="hk1">
                            Học kỳ I {defaultSchoolYear === selectedSchoolYear && ongoingSemester === 'hk1' ? '(Đang diễn ra)' : ''}
                          </option>
                          <option value="hk2">
                            Học kỳ II {defaultSchoolYear === selectedSchoolYear && ongoingSemester === 'hk2' ? '(Đang diễn ra)' : ''}
                          </option>
                          <option value="all">Cả năm (tách riêng 2 kỳ)</option>
                        </select>
                      </div>

                      {selectedSemesterFilter !== 'all' && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                            PHẠM VI THÁNG
                          </label>
                          <select
                            value={selectedMonthFilter}
                            onChange={(e) => setSelectedMonthFilter(e.target.value)}
                            className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] cursor-pointer"
                          >
                            <option value="all">
                              Trọn {getSemesterLabel(selectedSemesterFilter)}
                            </option>
                            {availableMonthsInScope.map((m) => (
                              <option key={m.value} value={m.value}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Nút “📗 Xuất Excel vi phạm” */}
                    <button
                      type="button"
                      onClick={handleExportViolationExcel}
                      disabled={isExportingExcel}
                      className="px-2.5 sm:px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50 shrink-0"
                      title="Tải tệp Excel tổng hợp vi phạm thi đua và kỷ luật của học sinh này"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="whitespace-nowrap">
                        {isExportingExcel ? 'Đang xuất...' : 'Xuất Excel vi phạm'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-200/70 text-emerald-900 shrink-0">
                        {periodBadgeLabel}
                      </span>
                    </button>
                  </div>

                  {/* HIỂN THỊ ĐIỂM THI ĐUA: ĐƠN LẺ 1 HỌC KỲ HOẶC TÁCH RIÊNG 2 HỌC KỲ KHI CHỌN CẢ NĂM */}
                  {selectedSemesterFilter !== 'all' ? (
                    <>
                      <div className="flex items-center justify-between gap-4 flex-wrap pt-1 border-t border-gray-200/60">
                        <div className="space-y-0.5">
                          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            ĐIỂM THI ĐUA CÒN LẠI ({getSemesterLabel(selectedSemesterFilter).toUpperCase()})
                          </div>
                          <div className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2 flex-wrap">
                            <span>
                              {currentSemesterEval.finalTotalPoints} / {currentSemesterEval.initialPoints}đ
                            </span>
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                                currentSemesterEval.plusPoints - currentSemesterEval.minusPoints >= 0
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                              title={`Điểm đầu kỳ: ${currentSemesterEval.initialPoints}đ, Thưởng: +${currentSemesterEval.plusPoints}đ, Trừ: -${currentSemesterEval.minusPoints}đ`}
                            >
                              ({currentSemesterEval.initialPoints} +{currentSemesterEval.plusPoints} -
                              {currentSemesterEval.minusPoints})
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-500">
                            Thời gian {getSemesterShortLabel(selectedSemesterFilter)}:{' '}
                            <strong className="text-gray-700">
                              {formatViDate(
                                selectedSemesterFilter === 'hk1'
                                  ? selectedYearSchedule.hk1Start
                                  : selectedYearSchedule.hk2Start
                              )}{' '}
                              –{' '}
                              {formatViDate(
                                selectedSemesterFilter === 'hk1'
                                  ? selectedYearSchedule.hk1End
                                  : selectedYearSchedule.hk2End
                              )}
                            </strong>
                          </div>
                        </div>

                        <div className="text-right space-y-1">
                          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            Xếp loại gợi ý ({getSemesterShortLabel(selectedSemesterFilter)})
                          </div>
                          <div>
                            <span
                              className={`inline-block px-3 py-1 rounded-xl text-xs sm:text-sm font-black border ${getSuggestedRatingBadgeClass(
                                currentSemesterEval.suggestedRating
                              )}`}
                            >
                              {currentSemesterEval.suggestedRating}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Đánh giá rèn luyện chính thức cho học kỳ đang xem */}
                      <div className="pt-2 border-t border-gray-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-700">
                            Đánh giá rèn luyện chính thức ({getSemesterShortLabel(selectedSemesterFilter)}):
                          </span>
                          {activeSemesterOfficial ? (
                            <span
                              className={`px-2.5 py-0.5 rounded-lg font-black border text-xs ${getSuggestedRatingBadgeClass(
                                activeSemesterOfficial.rating
                              )}`}
                            >
                              {activeSemesterOfficial.rating}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">
                              Chưa xác nhận (chờ GVCN)
                            </span>
                          )}
                          {activeSemesterOfficial?.reason && (
                            <span
                              className="text-gray-500 text-[11px] max-w-xs truncate"
                              title={activeSemesterOfficial.reason}
                            >
                              - {activeSemesterOfficial.reason}
                            </span>
                          )}
                        </div>

                        {isTeacher && (
                          <button
                            type="button"
                            onClick={() => openOfficialModalForSemester(selectedSemesterFilter)}
                            className="px-2.5 py-1 rounded-lg bg-[#FCF4F6] hover:bg-[#EDB5C1] text-[#1E293B] font-bold text-xs border border-[#EDB5C1] transition-all cursor-pointer self-start sm:self-auto flex items-center gap-1 active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              {activeSemesterOfficial
                                ? 'Điều chỉnh chính thức'
                                : 'Xác nhận chính thức'}
                            </span>
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    /* CHẾ ĐỘ CẢ NĂM: HIỂN THỊ TÁCH BIỆT HOÀN TOÀN HK I & HK II (KHÔNG CỘNG THÀNH 400Đ) */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-gray-200/60">
                      {/* Khối Học kỳ I */}
                      <div className="p-3 rounded-xl bg-white border border-sky-200/90 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-sky-900">
                            HỌC KỲ I
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-black border ${getSuggestedRatingBadgeClass(
                              hk1Emulation.suggestedRating
                            )}`}
                          >
                            Gợi ý: {hk1Emulation.suggestedRating}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-lg font-black text-gray-900">
                            {hk1Emulation.finalTotalPoints} / {hk1Emulation.initialPoints}đ
                          </span>
                          <span className="text-[11px] font-bold text-gray-600">
                            (+{hk1Emulation.plusPoints} / -{hk1Emulation.minusPoints})
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
                          <span>
                            Chính thức:{' '}
                            <strong className="text-gray-800">
                              {hk1Official?.rating || 'Chưa xác nhận'}
                            </strong>
                          </span>
                          {isTeacher && (
                            <button
                              type="button"
                              onClick={() => openOfficialModalForSemester('hk1')}
                              className="text-[10px] font-bold text-[#1E293B] underline hover:text-pink-700 cursor-pointer"
                            >
                              {hk1Official ? 'Sửa' : 'Xác nhận'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Khối Học kỳ II */}
                      <div className="p-3 rounded-xl bg-white border border-emerald-200/90 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-emerald-900">
                            HỌC KỲ II
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-black border ${getSuggestedRatingBadgeClass(
                              hk2Emulation.suggestedRating
                            )}`}
                          >
                            Gợi ý: {hk2Emulation.suggestedRating}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-lg font-black text-gray-900">
                            {hk2Emulation.finalTotalPoints} / {hk2Emulation.initialPoints}đ
                          </span>
                          <span className="text-[11px] font-bold text-gray-600">
                            (+{hk2Emulation.plusPoints} / -{hk2Emulation.minusPoints})
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
                          <span>
                            Chính thức:{' '}
                            <strong className="text-gray-800">
                              {hk2Official?.rating || 'Chưa xác nhận'}
                            </strong>
                          </span>
                          {isTeacher && (
                            <button
                              type="button"
                              onClick={() => openOfficialModalForSemester('hk2')}
                              className="text-[10px] font-bold text-[#1E293B] underline hover:text-pink-700 cursor-pointer"
                            >
                              {hk2Official ? 'Sửa' : 'Xác nhận'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
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
                      {selectedSemesterFilter === 'all'
                        ? `Năm học ${selectedSchoolYear}`
                        : `${getSemesterLabel(selectedSemesterFilter)} • ${selectedSchoolYear}`}
                    </span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar scroll-smooth">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead className="sticky top-0 bg-white z-10 border-b border-gray-200 text-gray-600 font-bold">
                        <tr>
                          <th className="py-2.5 px-3 sm:px-4 w-28 sm:w-32">Ngày</th>
                          <th className="py-2.5 px-3 sm:px-4">Nội dung sự việc</th>
                          <th className="py-2.5 px-2 w-20 text-center">Học kỳ</th>
                          <th className="py-2.5 px-3 w-20 text-center">Điểm</th>
                          {isTeacher && (
                            <th className="py-2.5 px-3 w-24 text-center">Thao tác</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-700">
                        {displayedDiscipline.length === 0 ? (
                          <tr>
                            <td
                              colSpan={isTeacher ? 5 : 4}
                              className="py-14 text-center text-gray-400"
                            >
                              Chưa có sự việc nào được ghi nhận trong học kỳ này.
                            </td>
                          </tr>
                        ) : (
                          displayedDiscipline.map((d) => {
                            const scope = getRecordScope(
                              d,
                              state.semesterConfigs,
                              state.config.schoolYear
                            );
                            const isEditingThis = editingRecordId === d.id;
                            return (
                              <tr
                                key={d.id}
                                className={`transition-colors ${
                                  isEditingThis
                                    ? 'bg-[#FCF4F6]'
                                    : 'hover:bg-gray-50/70'
                                }`}
                              >
                                <td className="py-3 px-3 sm:px-4 font-medium text-gray-600 whitespace-nowrap text-xs sm:text-sm">
                                  {formatViDate(d.date)}
                                </td>
                                <td className="py-3 px-3 sm:px-4">
                                  <div className="font-bold text-gray-900 text-xs sm:text-sm">
                                    {d.ruleName}
                                  </div>
                                  {d.note && (
                                    <div className="text-xs text-gray-500 mt-0.5 font-normal">
                                      {d.note}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-2 text-center">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                      scope.semester === 'hk1'
                                        ? 'bg-sky-50 text-sky-800 border-sky-200'
                                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    }`}
                                  >
                                    {getSemesterShortLabel(scope.semester)}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center">
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
                                  <td className="py-3 px-3 text-center">
                                    <div className="inline-flex items-center justify-center gap-1">
                                      {onUpdateDiscipline && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleStartEditDiscipline(d);
                                          }}
                                          className="p-1.5 rounded-xl text-gray-400 hover:text-[#1E293B] hover:bg-[#FCF4F6] active:scale-90 transition-all cursor-pointer"
                                          title={`Chỉnh sửa sự việc "${d.ruleName}"`}
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (editingRecordId === d.id) {
                                            handleCancelEditDiscipline();
                                          }
                                          onDeleteDiscipline(d.id);
                                        }}
                                        className="p-1.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 active:scale-90 transition-all cursor-pointer"
                                        title={`Xóa sự việc "${d.ruleName}"`}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })
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
                  className="px-3 py-1.5 bg-[#FCF4F6] hover:bg-[#EDB5C1] text-[#1E293B] font-bold text-xs rounded-xl border border-[#EDB5C1] flex items-center gap-1.5 transition-colors cursor-pointer"
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
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:ring-[#EDB5C1] focus:border-[#EDB5C1]"
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
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs focus:ring-[#EDB5C1] focus:border-[#EDB5C1]"
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
                      className="px-4 py-1.5 bg-[#EDB5C1] hover:bg-[#E4A7B4] text-[#1E293B] font-black text-xs rounded-xl shadow-xs"
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
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Mật khẩu mặc định hệ thống khuyên dùng: 8 chữ số ngày sinh dạng <strong>ddmmyyyy</strong> (hoặc có tiền tố MS).
                  </p>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#EDB5C1] hover:bg-[#E4A7B4] text-[#1E293B] font-black text-xs rounded-xl shadow-xs transition-colors"
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
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#E5B2BD] flex flex-col">
            <div className="p-4 sm:p-5 border-b border-[#E5B2BD] flex items-center justify-between bg-[#EDB5C1] text-[#1E293B]">
              <h3 className="font-black text-sm sm:text-base">
                Xác Nhận Đánh Giá Rèn Luyện Chính Thức
              </h3>
              <button
                onClick={() => setIsOfficialModalOpen(false)}
                className="text-[#1E293B] hover:text-black font-black cursor-pointer"
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
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] cursor-pointer"
                >
                  <option value="Tốt">Tốt</option>
                  <option value="Khá">Khá</option>
                  <option value="Đạt">Đạt</option>
                  <option value="Chưa đạt">Chưa đạt</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Xếp loại gợi ý ({getSemesterLabel(officialTargetSemester)} • {selectedSchoolYear}):{' '}
                  <strong>
                    {officialTargetSemester === 'hk2'
                      ? hk2Emulation.suggestedRating
                      : hk1Emulation.suggestedRating}
                  </strong>
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
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] resize-none"
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
                  className="px-5 py-2 rounded-xl bg-[#EDB5C1] hover:bg-[#E4A7B4] text-[#1E293B] font-black text-xs shadow-md shadow-[#EDB5C1]/20 cursor-pointer"
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

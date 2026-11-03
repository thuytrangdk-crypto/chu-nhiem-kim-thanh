import React, { useState, useEffect } from 'react';
import {
  AppState,
  AttendanceStatus,
  BoardNotice,
  DisciplineRecord,
  DisciplineRule,
  EmulationConfig,
  NoteRecord,
  Student,
  UserRole,
} from './types';
import { DEFAULT_INITIAL_STATE } from './defaultData';
import { formatViDate, generateId, getTodayStr } from './utils/helpers';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginModal } from './components/LoginModal';
import { DashboardView } from './components/DashboardView';
import { StudentsView } from './components/StudentsView';
import { AttendanceView } from './components/AttendanceView';
import { BoardView } from './components/BoardView';
import { SettingsView } from './components/SettingsView';
import { StudentProfileModal } from './components/StudentProfileModal';
import { ClassSwitchModal } from './components/ClassSwitchModal';
import { SupabaseModal } from './components/SupabaseModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { QuickEditSchoolModal } from './components/QuickEditSchoolModal';
import { supabaseService, SyncStatus } from './services/supabaseService';
import { CheckCircle2, AlertCircle, User } from 'lucide-react';

const STORAGE_KEY = 'so_chu_nhiem_8a3_data';
const SESSION_AUTH_KEY = 'scn_session_auth';

const getTeacherSignature = (teacherName?: string) => {
  const t = (teacherName || '').trim();
  if (!t) return 'GVCN';
  if (
    t.toLowerCase().startsWith('cô ') ||
    t.toLowerCase().startsWith('thầy ') ||
    t.toLowerCase().startsWith('gvcn ')
  ) {
    return t.toLowerCase().startsWith('gvcn ') ? t : `GVCN ${t}`;
  }
  return `GVCN Cô ${t}`;
};

const normalizeTeacherNotices = (notices: BoardNotice[], teacherName?: string): BoardNotice[] => {
  const sig = getTeacherSignature(teacherName);
  return (notices || []).map((n) => {
    if (
      !n.author ||
      n.author === 'GVCN' ||
      n.author.includes('Thùy Trang') ||
      n.author.toLowerCase().startsWith('gvcn cô')
    ) {
      return { ...n, author: sig };
    }
    return n;
  });
};

interface ToastItem {
  id: string;
  msg: string;
  type: 'success' | 'error';
}

/**
 * Merge emulation configs safely so newer local changes (higher version or newer timestamp)
 * are never overwritten by stale remote payloads from Supabase.
 */
const mergeEmulationConfig = (
  localCfg?: EmulationConfig,
  remoteCfg?: EmulationConfig
): EmulationConfig | undefined => {
  if (!localCfg) return remoteCfg;
  if (!remoteCfg) return localCfg;
  const localVer = localCfg.version || 0;
  const remoteVer = remoteCfg.version || 0;
  if (localVer > remoteVer) return localCfg;
  if (remoteVer > localVer) return remoteCfg;
  const localTime = new Date(localCfg.updatedAt || 0).getTime();
  const remoteTime = new Date(remoteCfg.updatedAt || 0).getTime();
  return localTime >= remoteTime ? localCfg : remoteCfg;
};

const mergeClassEmulationConfigs = (
  localMap?: Record<string, EmulationConfig>,
  remoteMap?: Record<string, EmulationConfig>
): Record<string, EmulationConfig> => {
  const merged: Record<string, EmulationConfig> = { ...(remoteMap || {}) };
  if (localMap) {
    for (const [key, localCfg] of Object.entries(localMap)) {
      merged[key] = mergeEmulationConfig(localCfg, merged[key])!;
    }
  }
  return merged;
};

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.config && Array.isArray(parsed.students)) {
          const currentTeacher = parsed.config.teacherName || DEFAULT_INITIAL_STATE.config.teacherName;
          return {
            ...DEFAULT_INITIAL_STATE,
            ...parsed,
            config: {
              ...DEFAULT_INITIAL_STATE.config,
              ...parsed.config,
            },
            boardNotices: normalizeTeacherNotices(
              parsed.boardNotices || DEFAULT_INITIAL_STATE.boardNotices,
              currentTeacher
            ),
          };
        }
      }
    } catch (e) {
      console.error('Error reading localStorage', e);
    }
    return DEFAULT_INITIAL_STATE;
  });

  const [authRole, setAuthRole] = useState<UserRole | null>(() => {
    try {
      const session = sessionStorage.getItem(SESSION_AUTH_KEY);
      if (session) {
        const parsed = JSON.parse(session);
        return parsed.role || null;
      }
    } catch (e) {}
    return null;
  });

  const [authStudentId, setAuthStudentId] = useState<string | null>(() => {
    try {
      const session = sessionStorage.getItem(SESSION_AUTH_KEY);
      if (session) {
        const parsed = JSON.parse(session);
        return parsed.id || null;
      }
    } catch (e) {}
    return null;
  });

  const [currentView, setCurrentView] = useState<string>(() => {
    try {
      const session = sessionStorage.getItem(SESSION_AUTH_KEY);
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed.role === 'student') return 'board';
      }
    } catch (e) {}
    return 'dashboard';
  });
  const [activeBoardTab, setActiveBoardTab] = useState<'notices' | 'seating' | 'honor'>('notices');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Enforce student view restriction: students can only access 'board' (with subtabs) and own profile modal
  useEffect(() => {
    if (authRole === 'student') {
      if (currentView !== 'board') {
        setCurrentView('board');
      }
    }
  }, [authRole, currentView]);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isClassSwitchOpen, setIsClassSwitchOpen] = useState(false);
  const [isQuickEditSchoolOpen, setIsQuickEditSchoolOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isTeacherPasswordModalOpen, setIsTeacherPasswordModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Supabase cloud sync status
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isConnected: false,
    isTableReady: false,
    isSyncing: false,
    lastSyncedAt: null,
    errorMessage: null,
  });

  const persistStateImmediately = (nextState: AppState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      if (syncStatus.isTableReady) {
        supabaseService.saveState(nextState).then((res) => {
          setSyncStatus((prev) => ({
            ...prev,
            isSyncing: false,
            lastSyncedAt: res.success
              ? new Date().toLocaleTimeString('vi-VN')
              : prev.lastSyncedAt,
            errorMessage: res.error || null,
          }));
        });
      }
    } catch (e) {
      console.error('Error persisting state immediately', e);
    }
  };

  // Persist state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Error saving state', e);
    }
  }, [state]);

  // Update HTML document title
  useEffect(() => {
    document.title = state.config.appName || 'Sổ Chủ Nhiệm Điện Tử';
  }, [state.config.appName]);

  // Initial Supabase connection check and sync
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initSupabase = async () => {
      const { isConnected, isTableReady, error } =
        await supabaseService.checkConnection();

      setSyncStatus((prev) => ({
        ...prev,
        isConnected,
        isTableReady,
        errorMessage: error || null,
      }));

      if (isTableReady) {
        // Load remote data
        const { state: remoteState } = await supabaseService.loadState();
        if (remoteState && remoteState.students) {
          const currentTeacher = remoteState.config?.teacherName || state.config.teacherName || 'Cô Lê Thị Kim Thanh';
          const normalizedNotices = normalizeTeacherNotices(remoteState.boardNotices || [], currentTeacher);
          setState((prev) => {
            const mergedClassConfigs = mergeClassEmulationConfigs(
              prev.classEmulationConfigs,
              remoteState.classEmulationConfigs
            );
            const mergedEmulationConfig = mergeEmulationConfig(
              prev.emulationConfig,
              remoteState.emulationConfig
            );
            return {
              ...prev,
              ...remoteState,
              config: {
                ...prev.config,
                ...remoteState.config,
              },
              boardNotices: normalizedNotices,
              classEmulationConfigs: mergedClassConfigs,
              emulationConfig: mergedEmulationConfig || prev.emulationConfig,
            };
          });
          setSyncStatus((prev) => ({
            ...prev,
            lastSyncedAt: new Date().toLocaleTimeString('vi-VN'),
          }));
        }

        // Subscribe to real-time changes from other tabs or devices
        unsubscribe = supabaseService.subscribe((updatedRemote) => {
          if (updatedRemote && updatedRemote.students) {
            setState((prev) => {
              const mergedClassConfigs = mergeClassEmulationConfigs(
                prev.classEmulationConfigs,
                updatedRemote.classEmulationConfigs
              );
              const mergedEmulationConfig = mergeEmulationConfig(
                prev.emulationConfig,
                updatedRemote.emulationConfig
              );
              return {
                ...prev,
                ...updatedRemote,
                classEmulationConfigs: mergedClassConfigs,
                emulationConfig: mergedEmulationConfig || prev.emulationConfig,
              };
            });
            setSyncStatus((prev) => ({
              ...prev,
              lastSyncedAt: new Date().toLocaleTimeString('vi-VN'),
            }));
          }
        });
      }
    };

    initSupabase();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Debounced auto-save to Supabase when state changes
  useEffect(() => {
    if (!syncStatus.isTableReady) return;

    const timer = setTimeout(async () => {
      setSyncStatus((prev) => ({ ...prev, isSyncing: true }));
      const res = await supabaseService.saveState(state);
      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncedAt: res.success
          ? new Date().toLocaleTimeString('vi-VN')
          : prev.lastSyncedAt,
        errorMessage: res.error || null,
      }));
    }, 1500);

    return () => clearTimeout(timer);
  }, [state, syncStatus.isTableReady]);

  // Auto-clean any legacy notices with old teacher author name
  useEffect(() => {
    const hasOldAuthor = state.boardNotices.some(
      (n) => n.author && n.author.includes('Thùy Trang')
    );
    if (hasOldAuthor) {
      const normalizedNotices = normalizeTeacherNotices(
        state.boardNotices,
        state.config.teacherName
      );
      setState((prev) => {
        const nextState = {
          ...prev,
          boardNotices: normalizedNotices,
        };
        persistStateImmediately(nextState);
        return nextState;
      });
    }
  }, [state.config.teacherName, state.boardNotices]);

  const handleCheckSupabaseConnection = async () => {
    const res = await supabaseService.checkConnection();
    setSyncStatus((prev) => ({
      ...prev,
      isConnected: res.isConnected,
      isTableReady: res.isTableReady,
      errorMessage: res.error || null,
    }));
    if (res.isTableReady) {
      showToast('Đã kết nối thành công với Supabase Cloud!');
    } else {
      showToast(res.error || 'Cần chạy mã SQL tạo bảng trên Supabase.', 'error');
    }
  };

  const handleSyncNow = async () => {
    setSyncStatus((prev) => ({ ...prev, isSyncing: true }));
    const res = await supabaseService.saveState(state);
    setSyncStatus((prev) => ({
      ...prev,
      isSyncing: false,
      lastSyncedAt: res.success ? new Date().toLocaleTimeString('vi-VN') : prev.lastSyncedAt,
      errorMessage: res.error || null,
    }));
    if (res.success) {
      showToast('Đã đồng bộ toàn bộ dữ liệu lên Supabase Cloud!');
    } else {
      showToast(res.error || 'Lỗi đồng bộ dữ liệu lên Supabase', 'error');
    }
  };

  const handlePullRemote = async () => {
    const res = await supabaseService.loadState();
    if (res.state && res.state.students) {
      setState(res.state);
      showToast('Đã tải và áp dụng dữ liệu mới từ Supabase Cloud!');
    } else {
      showToast(res.error || 'Chưa có bản ghi nào trên Supabase Cloud.', 'error');
    }
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  const handleSaveClassSwitch = (data: {
    className: string;
    schoolYear: string;
    teacherName: string;
    availableClasses: string[];
  }) => {
    setState((prev) => {
      const nextState: AppState = {
        ...prev,
        config: {
          ...prev.config,
          className: data.className,
          schoolYear: data.schoolYear,
          teacherName: data.teacherName,
          availableClasses: data.availableClasses,
        },
        boardNotices: normalizeTeacherNotices(prev.boardNotices, data.teacherName),
      };
      persistStateImmediately(nextState);
      return nextState;
    });
    showToast(`Đã chuyển sang Lớp ${data.className} (Năm học ${data.schoolYear})`);
  };

  const handleSaveQuickEditSchool = (data: {
    schoolName: string;
    className: string;
    schoolYear: string;
    teacherName: string;
  }) => {
    setState((prev) => {
      const nextState: AppState = {
        ...prev,
        config: {
          ...prev.config,
          schoolName: data.schoolName,
          className: data.className,
          schoolYear: data.schoolYear,
          teacherName: data.teacherName,
        },
        boardNotices: normalizeTeacherNotices(prev.boardNotices, data.teacherName),
      };
      persistStateImmediately(nextState);
      return nextState;
    });
    showToast(`Đã cập nhật: ${data.schoolName} - Lớp ${data.className} (${data.schoolYear})`);
  };

  const handleUpdateSeatingChart = (newChart: Record<string, string>) => {
    setState((prev) => ({
      ...prev,
      seatingChart: newChart,
    }));
  };

  // Auth Handlers
  const handleLoginTeacher = () => {
    setAuthRole('teacher');
    setAuthStudentId(null);
    sessionStorage.setItem(
      SESSION_AUTH_KEY,
      JSON.stringify({ role: 'teacher', id: null })
    );
    showToast(`Xin chào cô ${state.config.teacherName}`);
  };

  const handleLoginStudent = (studentId: string) => {
    setAuthRole('student');
    setAuthStudentId(studentId);
    setSelectedStudentId(null);
    setCurrentView('board');
    setActiveBoardTab('notices');
    sessionStorage.setItem(
      SESSION_AUTH_KEY,
      JSON.stringify({ role: 'student', id: studentId })
    );
    const s = state.students.find((x) => x.id === studentId);
    showToast(`Xin chào học sinh ${s ? s.name : ''}`);
  };

  const handleLogout = () => {
    setAuthRole(null);
    setAuthStudentId(null);
    setSelectedStudentId(null);
    sessionStorage.removeItem(SESSION_AUTH_KEY);
    showToast('Đã đăng xuất khỏi hệ thống');
  };

  // Student CRUD
  const handleAddStudent = (newStudentData: Partial<Student>) => {
    const dobFormatted = newStudentData.dob ? formatViDate(newStudentData.dob) : '';
    const newStudent: Student = {
      ...(newStudentData as Student),
      password:
        newStudentData.password?.trim() ||
        dobFormatted ||
        newStudentData.dob ||
        '123',
    };
    setState((prev) => ({
      ...prev,
      students: [...prev.students, newStudent],
    }));
    showToast(`Đã thêm học sinh: ${newStudent.name} (Mật khẩu: ${newStudent.password})`);
  };

  const handleUpdateStudent = (studentData: Partial<Student>) => {
    setState((prev) => ({
      ...prev,
      students: prev.students.map((s) =>
        s.id === studentData.id ? ({ ...s, ...studentData } as Student) : s
      ),
    }));
    showToast('Đã cập nhật thông tin học sinh');
  };

  const handleDeleteStudent = (studentId: string) => {
    setState((prev) => ({
      ...prev,
      students: prev.students.filter((s) => s.id !== studentId),
      attendance: prev.attendance.filter((a) => a.studentId !== studentId),
      discipline: prev.discipline.filter((d) => d.studentId !== studentId),
      notes: prev.notes.filter((n) => n.studentId !== studentId),
    }));
    if (selectedStudentId === studentId) {
      setSelectedStudentId(null);
    }
    showToast('Đã xóa học sinh khỏi danh sách');
  };

  const INITIAL_SAMPLE_IDS = new Set([
    '15052012',
    '20082012',
    '10112012',
    '03022012',
    '18092012',
    '25122012',
    '09042012',
    '14072012',
  ]);

  const handleBatchImportStudents = (
    newStudents: Student[],
    mode: 'append' | 'replace' = 'replace'
  ) => {
    let nextStateToSave: AppState | null = null;
    const formattedStudents = newStudents.map((s) => ({
      ...s,
      password: s.password?.trim() || (s.dob ? formatViDate(s.dob) : '123'),
    }));

    setState((prev) => {
      let updatedStudents: Student[];
      let updatedAttendance = prev.attendance;
      let updatedDiscipline = prev.discipline;
      let updatedNotes = prev.notes;
      let updatedSeating = prev.seatingChart;

      if (mode === 'replace') {
        // REPLACE ENTIRELY: only keep the new list of students!
        updatedStudents = formattedStudents;
        const newIds = new Set(formattedStudents.map((s) => s.id));
        updatedAttendance = prev.attendance.filter((a) => newIds.has(a.studentId));
        updatedDiscipline = prev.discipline.filter((d) => newIds.has(d.studentId));
        updatedNotes = prev.notes.filter((n) => newIds.has(n.studentId));
        updatedSeating = Object.fromEntries(
          Object.entries(prev.seatingChart || {}).filter(([_, id]) => newIds.has(id))
        );
      } else {
        // Append mode: avoid duplicate additions
        const existingNames = new Set(prev.students.map((s) => `${s.name.toLowerCase().trim()}_${s.dob}`));
        const toAdd = formattedStudents.filter(
          (s) => !existingNames.has(`${s.name.toLowerCase().trim()}_${s.dob}`)
        );
        updatedStudents = [...prev.students, ...toAdd];
      }

      nextStateToSave = {
        ...prev,
        students: updatedStudents,
        attendance: updatedAttendance,
        discipline: updatedDiscipline,
        notes: updatedNotes,
        seatingChart: updatedSeating,
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStateToSave));
      } catch (e) {}

      return nextStateToSave;
    });

    // Immediate sync to Supabase Cloud so other devices & reloads get the clean 44 students immediately
    if (nextStateToSave && syncStatus.isTableReady) {
      supabaseService.saveState(nextStateToSave).then((res) => {
        if (res.success) {
          setSyncStatus((s) => ({
            ...s,
            lastSyncedAt: new Date().toLocaleTimeString('vi-VN'),
          }));
        }
      });
    }

    showToast(
      mode === 'replace'
        ? `Đã thay thế toàn bộ danh sách lớp: còn đúng ${newStudents.length} học sinh!`
        : `Đã nhập thành công ${newStudents.length} học sinh vào lớp`
    );
  };

  const handleRemoveSampleStudents = () => {
    let nextStateToSave: AppState | null = null;
    setState((prev) => {
      const updatedStudents = prev.students.filter((s) => !INITIAL_SAMPLE_IDS.has(s.id));
      const newIds = new Set(updatedStudents.map((s) => s.id));
      const updatedAttendance = prev.attendance.filter((a) => newIds.has(a.studentId));
      const updatedDiscipline = prev.discipline.filter((d) => newIds.has(d.studentId));
      const updatedNotes = prev.notes.filter((n) => newIds.has(n.studentId));
      const updatedSeating = Object.fromEntries(
        Object.entries(prev.seatingChart || {}).filter(([_, id]) => newIds.has(id))
      );

      nextStateToSave = {
        ...prev,
        students: updatedStudents,
        attendance: updatedAttendance,
        discipline: updatedDiscipline,
        notes: updatedNotes,
        seatingChart: updatedSeating,
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStateToSave));
      } catch (e) {}

      return nextStateToSave;
    });

    if (nextStateToSave && syncStatus.isTableReady) {
      supabaseService.saveState(nextStateToSave).then((res) => {
        if (res.success) {
          setSyncStatus((s) => ({
            ...s,
            lastSyncedAt: new Date().toLocaleTimeString('vi-VN'),
          }));
        }
      });
    }

    showToast('Đã xóa sạch 8 học sinh mẫu ban đầu, hiện chỉ giữ lại học sinh của lớp!');
  };

  const handleClearAllStudents = () => {
    let nextStateToSave: AppState | null = null;
    setState((prev) => {
      nextStateToSave = {
        ...prev,
        students: [],
        attendance: [],
        discipline: [],
        notes: [],
        seatingChart: {},
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStateToSave));
      } catch (e) {}

      return nextStateToSave;
    });

    if (nextStateToSave && syncStatus.isTableReady) {
      supabaseService.saveState(nextStateToSave).then((res) => {
        if (res.success) {
          setSyncStatus((s) => ({
            ...s,
            lastSyncedAt: new Date().toLocaleTimeString('vi-VN'),
          }));
        }
      });
    }

    showToast('Đã xóa toàn bộ học sinh của lớp!');
  };

  const handleUpdateAvatar = (studentId: string, base64: string) => {
    setState((prev) => ({
      ...prev,
      students: prev.students.map((s) =>
        s.id === studentId ? { ...s, avatar: base64 } : s
      ),
    }));
  };

  const handleSaveGrades = (studentId: string, grades: Record<string, number>) => {
    setState((prev) => ({
      ...prev,
      students: prev.students.map((s) =>
        s.id === studentId ? { ...s, grades } : s
      ),
    }));
  };

  const handleChangePassword = (studentId: string, newPass: string) => {
    setState((prev) => ({
      ...prev,
      students: prev.students.map((s) =>
        s.id === studentId ? { ...s, password: newPass } : s
      ),
    }));
  };

  // Attendance Handlers
  const handleUpdateAttendanceStatus = (
    studentId: string,
    date: string,
    status: AttendanceStatus
  ) => {
    setState((prev) => {
      const idx = prev.attendance.findIndex(
        (a) => a.studentId === studentId && a.date === date
      );
      if (idx > -1) {
        const nextAtt = [...prev.attendance];
        nextAtt[idx] = { ...nextAtt[idx], status };
        return { ...prev, attendance: nextAtt };
      }
      return {
        ...prev,
        attendance: [
          ...prev.attendance,
          { id: generateId(), studentId, date, status },
        ],
      };
    });
  };

  const handleMarkAllPresent = (date: string) => {
    setState((prev) => {
      const nextAtt = [...prev.attendance];
      prev.students.forEach((s) => {
        const idx = nextAtt.findIndex(
          (a) => a.studentId === s.id && a.date === date
        );
        if (idx > -1) {
          nextAtt[idx] = { ...nextAtt[idx], status: 'c' };
        } else {
          nextAtt.push({
            id: generateId(),
            studentId: s.id,
            date,
            status: 'c',
          });
        }
      });
      return { ...prev, attendance: nextAtt };
    });
    showToast('Đã đánh dấu tất cả có mặt cho ngày đã chọn');
  };

  // Discipline Handlers (with auto sync attendance!)
  const handleAddDiscipline = (record: Omit<DisciplineRecord, 'id'>) => {
    const newDiscipline: DisciplineRecord = {
      ...record,
      id: generateId(),
    };

    // Auto sync attendance if rule name matches late/unexcused
    const ruleLower = record.ruleName.toLowerCase();
    let syncedStatus: AttendanceStatus | null = null;
    if (ruleLower.includes('muộn') || ruleLower.includes('trễ')) {
      syncedStatus = 'm';
    } else if (
      ruleLower.includes('không phép') ||
      ruleLower.includes('cúp tiết') ||
      ruleLower.includes('trốn học')
    ) {
      syncedStatus = 'kp';
    } else if (
      ruleLower.includes('nghỉ học') ||
      ruleLower.includes('vắng') ||
      ruleLower.includes('bỏ tiết')
    ) {
      syncedStatus = 'v';
    }

    setState((prev) => {
      let nextAtt = prev.attendance;
      if (syncedStatus) {
        const idx = nextAtt.findIndex(
          (a) => a.studentId === record.studentId && a.date === record.date
        );
        if (idx > -1) {
          nextAtt = nextAtt.map((a, i) =>
            i === idx ? { ...a, status: syncedStatus as AttendanceStatus } : a
          );
        } else {
          nextAtt = [
            ...nextAtt,
            {
              id: generateId(),
              studentId: record.studentId,
              date: record.date,
              status: syncedStatus as AttendanceStatus,
            },
          ];
        }
      }

      const nextState: AppState = {
        ...prev,
        discipline: [...prev.discipline, newDiscipline],
        attendance: nextAtt,
      };
      persistStateImmediately(nextState);
      return nextState;
    });

    if (syncedStatus) {
      showToast('Đã ghi nhận thi đua & tự động đồng bộ Điểm danh');
    } else {
      showToast('Đã ghi nhận sự việc thi đua thành công');
    }
  };

  const handleDeleteDiscipline = (recordId: string) => {
    setState((prev) => {
      const nextState: AppState = {
        ...prev,
        discipline: prev.discipline.filter((d) => d.id !== recordId),
      };
      persistStateImmediately(nextState);
      return nextState;
    });
    showToast('Đã xóa sự việc thi đua thành công');
  };

  // Notes Handlers
  const handleAddNote = (record: Omit<NoteRecord, 'id'>) => {
    const newNote: NoteRecord = {
      ...record,
      id: generateId(),
    };
    setState((prev) => {
      const nextState: AppState = {
        ...prev,
        notes: [...prev.notes, newNote],
      };
      persistStateImmediately(nextState);
      return nextState;
    });
  };

  const handleDeleteNote = (noteId: string) => {
    setState((prev) => {
      const nextState: AppState = {
        ...prev,
        notes: prev.notes.filter((n) => n.id !== noteId),
      };
      persistStateImmediately(nextState);
      return nextState;
    });
  };

  // Board Notices Handlers
  const handleAddNotice = (notice: Omit<BoardNotice, 'id'>) => {
    const newNotice: BoardNotice = {
      ...notice,
      id: generateId(),
    };
    setState((prev) => ({
      ...prev,
      boardNotices: [...prev.boardNotices, newNotice],
    }));
    showToast('Đã đăng thông báo mới lên bảng tin');
  };

  const handleDeleteNotice = (noticeId: string) => {
    setState((prev) => ({
      ...prev,
      boardNotices: prev.boardNotices.filter((n) => n.id !== noticeId),
    }));
    showToast('Đã xóa thông báo');
  };

  // Config & Reset Handlers
  const handleUpdateConfig = (newConfig: Partial<AppState['config']>) => {
    setState((prev) => {
      const updatedTeacher = newConfig.teacherName || prev.config.teacherName;
      const nextState: AppState = {
        ...prev,
        config: {
          ...prev.config,
          ...newConfig,
        },
        boardNotices: newConfig.teacherName
          ? normalizeTeacherNotices(prev.boardNotices, updatedTeacher)
          : prev.boardNotices,
      };
      persistStateImmediately(nextState);
      return nextState;
    });
  };

  const handleUpdateDisciplineRules = (rules: DisciplineRule[]) => {
    setState((prev) => {
      const nextState: AppState = {
        ...prev,
        disciplineRules: rules,
      };
      persistStateImmediately(nextState);
      return nextState;
    });
  };

  const handleUpdateEmulationConfig = async (
    newConfig: EmulationConfig
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      let nextStateToSave: AppState | null = null;

      setState((prev) => {
        const className = prev.config.className || '6A8';
        const schoolYear = prev.config.schoolYear || '2024 - 2025';
        const classKey = `${className}_${schoolYear}`;
        const nextState: AppState = {
          ...prev,
          emulationConfig: newConfig,
          classEmulationConfigs: {
            ...(prev.classEmulationConfigs || {}),
            [classKey]: newConfig,
          },
        };
        nextStateToSave = nextState;

        // 1. Lưu ngay lập tức vào LocalStorage để đảm bảo tải lại trang vẫn giữ cấu hình
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
        } catch (e) {
          console.error('LocalStorage save error', e);
        }
        return nextState;
      });

      // 2. Đồng bộ lên Supabase Cloud nếu sẵn sàng
      if (syncStatus.isTableReady && nextStateToSave) {
        setSyncStatus((prev) => ({ ...prev, isSyncing: true }));
        const res = await supabaseService.saveState(nextStateToSave);
        setSyncStatus((prev) => ({
          ...prev,
          isSyncing: false,
          lastSyncedAt: res.success
            ? new Date().toLocaleTimeString('vi-VN')
            : prev.lastSyncedAt,
          errorMessage: res.error || null,
        }));
        if (!res.success) {
          return {
            success: false,
            error: res.error || 'Lỗi khi đồng bộ lên cơ sở dữ liệu Supabase',
          };
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Lỗi khi lưu cấu hình' };
    }
  };

  const handleResetData = () => {
    setState(DEFAULT_INITIAL_STATE);
  };

  const handleClearAllData = () => {
    setState({
      config: DEFAULT_INITIAL_STATE.config,
      students: [],
      attendance: [],
      discipline: [],
      notes: [],
      boardNotices: [],
    });
  };

  const handleImportBackup = (backupState: AppState) => {
    setState(backupState);
  };

  // Page titles
  const pageTitles: Record<string, string> = {
    dashboard: 'Tổng quan Lớp học',
    board: 'Bảng tin & Vinh danh Thi đua',
    students: 'Danh sách & Quản lý Học sinh',
    attendance: 'Điểm danh Chuyên cần',
    settings: 'Cài đặt Hệ thống',
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#fff6f8] font-sans text-gray-800">
      {/* 1. Login Modal if unauthenticated */}
      {!authRole && (
        <LoginModal
          appName={state.config.appName}
          teacherPassword={state.config.teacherPassword}
          students={state.students}
          onLoginTeacher={handleLoginTeacher}
          onLoginStudent={handleLoginStudent}
        />
      )}

      {/* 2. Authenticated layout (Teacher or Student) */}
      {authRole && (
        <>
          <Sidebar
            currentView={currentView}
            onNavigate={(view) => setCurrentView(view)}
            className={state.config.className}
            schoolName={state.config.schoolName}
            classAvatar={state.config.classAvatar}
            isTeacher={authRole === 'teacher'}
            studentName={state.students.find((s) => s.id === authStudentId)?.name}
            teacherName={state.config.teacherName}
            onUpdateClassAvatar={(base64) =>
              handleUpdateConfig({ classAvatar: base64 })
            }
            onOpenClassSwitch={() => setIsClassSwitchOpen(true)}
            onLogout={handleLogout}
            isMobileOpen={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
            onOpenChangePassword={() => setIsTeacherPasswordModalOpen(true)}
            onOpenMyProfile={() => {
              if (authStudentId) setSelectedStudentId(authStudentId);
            }}
            syncStatus={syncStatus}
            activeBoardTab={activeBoardTab}
            onSelectBoardTab={setActiveBoardTab}
          />

          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            <Header
              title={pageTitles[currentView] || 'Trợ lý chủ nhiệm'}
              className={state.config.className}
              schoolName={state.config.schoolName}
              schoolYear={state.config.schoolYear}
              teacherName={state.config.teacherName}
              isTeacher={authRole === 'teacher'}
              studentName={state.students.find((s) => s.id === authStudentId)?.name}
              syncStatus={syncStatus}
              onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
              onOpenClassSwitch={() => setIsClassSwitchOpen(true)}
              onGoHome={() => setCurrentView(authRole === 'teacher' ? 'dashboard' : 'board')}
              onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
              onOpenChangePassword={() => setIsTeacherPasswordModalOpen(true)}
              onOpenMyProfile={() => {
                if (authStudentId) setSelectedStudentId(authStudentId);
              }}
              onOpenQuickEditSchool={() => setIsQuickEditSchoolOpen(true)}
              onLogout={handleLogout}
            />

            <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-8 bg-[#FCF4F6] custom-scrollbar">
              {/* TOP PASTEL PINK HERO BANNER FOR STUDENT (#EDB5C1, CHỮ XANH ĐEN #1E293B) */}
              {authRole === 'student' && authStudentId && (() => {
                const currentStudent = state.students.find((s) => s.id === authStudentId);
                if (!currentStudent) return null;
                return (
                  <div className="bg-[#EDB5C1] text-[#1E293B] border border-[#E5B2BD] rounded-3xl p-5 sm:p-6 mb-5 shadow-md shadow-[#EDB5C1]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white text-[#1E293B] ring-2 ring-[#1E293B]/10 flex items-center justify-center font-black text-xl sm:text-2xl shadow-sm shrink-0">
                        {currentStudent.name.charAt(currentStudent.name.lastIndexOf(' ') + 1) || currentStudent.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/60 text-[11px] font-bold text-[#1E293B] mb-1 border border-white/40">
                          <span>Học sinh Lớp {state.config.className || '6A8'}</span>
                          <span>•</span>
                          <span>Năm học {state.config.schoolYear || '2026-2027'}</span>
                        </div>
                        <h2 className="text-base sm:text-2xl font-black uppercase tracking-tight text-[#1E293B] truncate">
                          {currentStudent.name}
                        </h2>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedStudentId(currentStudent.id)}
                      className="px-5 py-2.5 rounded-2xl bg-[#1E293B] hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center gap-2 self-start sm:self-auto cursor-pointer shrink-0"
                    >
                      <User className="w-4 h-4 text-[#EDB5C1]" />
                      <span>Xem Hồ sơ của tôi</span>
                    </button>
                  </div>
                );
              })()}

              {/* TEACHER-ONLY VIEWS */}
              {authRole === 'teacher' && currentView === 'dashboard' && (
                <DashboardView
                  state={state}
                  isTeacher={true}
                  currentStudentId={null}
                  onSelectStudent={(id) => setSelectedStudentId(id)}
                  onNavigate={(view) => setCurrentView(view)}
                  onShowToast={showToast}
                  onOpenQuickEditSchool={() => setIsQuickEditSchoolOpen(true)}
                />
              )}

              {authRole === 'teacher' && currentView === 'students' && (
                <StudentsView
                  state={state}
                  onSelectStudent={(id) => setSelectedStudentId(id)}
                  onAddStudent={handleAddStudent}
                  onUpdateStudent={handleUpdateStudent}
                  onDeleteStudent={handleDeleteStudent}
                  onBatchImportStudents={handleBatchImportStudents}
                  onRemoveSampleStudents={handleRemoveSampleStudents}
                  onClearAllStudents={handleClearAllStudents}
                  isTeacher={true}
                  currentStudentId={null}
                  onShowToast={showToast}
                />
              )}

              {authRole === 'teacher' && currentView === 'attendance' && (
                <AttendanceView
                  state={state}
                  onUpdateAttendanceStatus={handleUpdateAttendanceStatus}
                  onMarkAllPresent={handleMarkAllPresent}
                  onSaveNotice={() => showToast('Đã lưu dữ liệu điểm danh')}
                  onSelectStudent={(id) => setSelectedStudentId(id)}
                  isTeacher={true}
                  currentStudentId={null}
                  onShowToast={showToast}
                />
              )}

              {/* SHARED BOARD VIEW (STUDENT ACCEPTS ONLY READ-ONLY, HIGHLIGHTS DESK) */}
              {currentView === 'board' && (
                <BoardView
                  state={state}
                  onAddNotice={handleAddNotice}
                  onDeleteNotice={handleDeleteNotice}
                  onUpdateSeatingChart={handleUpdateSeatingChart}
                  onSelectStudent={(id) => {
                    if (authRole === 'teacher' || id === authStudentId) {
                      setSelectedStudentId(id);
                    } else {
                      showToast('Bảo mật: Bạn chỉ có thể xem hồ sơ của chính mình!', 'error');
                    }
                  }}
                  isTeacher={authRole === 'teacher'}
                  authStudentId={authStudentId}
                  activeTab={activeBoardTab}
                  onTabChange={setActiveBoardTab}
                  onShowToast={showToast}
                />
              )}

              {authRole === 'teacher' && currentView === 'settings' && (
                <SettingsView
                  state={state}
                  onUpdateConfig={handleUpdateConfig}
                  onUpdateDisciplineRules={handleUpdateDisciplineRules}
                  onUpdateEmulationConfig={handleUpdateEmulationConfig}
                  onResetData={handleResetData}
                  onClearAllData={handleClearAllData}
                  onImportBackup={handleImportBackup}
                  onShowToast={showToast}
                  syncStatus={syncStatus}
                  onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
                />
              )}
            </main>
          </div>

          {/* Quick Class & Year Switch Modal */}
          {authRole === 'teacher' && (
            <ClassSwitchModal
              isOpen={isClassSwitchOpen}
              currentClass={state.config.className}
              currentYear={state.config.schoolYear}
              teacherName={state.config.teacherName}
              availableClasses={state.config.availableClasses || ['9A5', '8A3', '7A1', '6A2']}
              onSave={handleSaveClassSwitch}
              onClose={() => setIsClassSwitchOpen(false)}
            />
          )}

          {/* Quick Edit School & Year Modal (Cho phép giáo viên chủ nhiệm sửa linh động từ bên ngoài) */}
          {authRole === 'teacher' && (
            <QuickEditSchoolModal
              isOpen={isQuickEditSchoolOpen}
              schoolName={state.config.schoolName || 'Trường THCS Chu Văn An'}
              className={state.config.className}
              schoolYear={state.config.schoolYear}
              teacherName={state.config.teacherName}
              onSave={handleSaveQuickEditSchool}
              onClose={() => setIsQuickEditSchoolOpen(false)}
            />
          )}

          {/* Teacher Change Password Modal */}
          <ChangePasswordModal
            isOpen={isTeacherPasswordModalOpen}
            title="Đổi Mật khẩu Quản lý Giáo viên"
            description="Cập nhật mật khẩu để bảo vệ hệ thống quản lý lớp học"
            currentPassword={state.config.teacherPassword}
            onSave={(newPass) => {
              handleUpdateConfig({ teacherPassword: newPass });
              showToast('Đã đổi mật khẩu giáo viên thành công!');
            }}
            onClose={() => setIsTeacherPasswordModalOpen(false)}
          />

          {/* Supabase Cloud Connection & Sync Modal */}
          <SupabaseModal
            isOpen={isSupabaseModalOpen}
            syncStatus={syncStatus}
            onCheckConnection={handleCheckSupabaseConnection}
            onSyncNow={handleSyncNow}
            onPullRemote={handlePullRemote}
            onClose={() => setIsSupabaseModalOpen(false)}
          />

          {/* Student Profile Modal (Accessible by Teacher for any student, or Student for self) */}
          {selectedStudentId && (
            <StudentProfileModal
              studentId={selectedStudentId}
              state={state}
              isTeacher={authRole === 'teacher'}
              onClose={() => setSelectedStudentId(null)}
              onEditStudent={(s) => {
                setSelectedStudentId(null);
                setCurrentView('students');
              }}
              onUpdateAvatar={handleUpdateAvatar}
              onSaveGrades={handleSaveGrades}
              onAddDiscipline={handleAddDiscipline}
              onDeleteDiscipline={handleDeleteDiscipline}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
              onChangePassword={handleChangePassword}
              onLogout={handleLogout}
              onShowToast={showToast}
            />
          )}
        </>
      )}

      {/* Floating Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-[300] flex flex-col gap-2.5 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs sm:text-sm font-semibold pointer-events-auto animate-fadeIn ${
              toast.type === 'success'
                ? 'bg-slate-900 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-white shrink-0" />
            )}
            <span>{toast.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

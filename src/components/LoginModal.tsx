import React, { useState, useEffect } from 'react';
import { Student } from '../types';
import {
  GraduationCap,
  ShieldCheck,
  User,
  Lock,
  ArrowRight,
  KeyRound,
  Calendar,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { authenticateStudentByPassword } from '../utils/helpers';

interface LoginModalProps {
  appName?: string;
  className?: string;
  schoolYear?: string;
  teacherPassword?: string;
  students: Student[];
  onLoginTeacher: () => void;
  onLoginStudent: (studentId: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  appName,
  className = '6A8',
  schoolYear = '2026-2027',
  teacherPassword = '123',
  students,
  onLoginTeacher,
  onLoginStudent,
}) => {
  const [activeTab, setActiveTab] = useState<'teacher' | 'student'>('student');

  // Teacher login state
  const [teacherInputPass, setTeacherInputPass] = useState('');
  const [teacherError, setTeacherError] = useState('');

  // Student login state: ONLY ONE PASSWORD INPUT (No ID, No Name, No list)
  const [studentPassword, setStudentPassword] = useState('');
  const [studentError, setStudentError] = useState('');

  // Rate limiting state
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockCountdown, setLockCountdown] = useState(0);

  // Countdown timer for rate limiting
  useEffect(() => {
    if (lockCountdown <= 0) return;
    const timer = setInterval(() => {
      setLockCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockCountdown]);

  const handleTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherInputPass.trim()) {
      setTeacherError('Vui lòng nhập mật khẩu giáo viên');
      return;
    }
    if (teacherInputPass.trim() === teacherPassword.trim()) {
      onLoginTeacher();
    } else {
      setTeacherError('Mật khẩu không chính xác! (Mặc định: 123)');
    }
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStudentError('');

    if (lockCountdown > 0) {
      setStudentError(`Bạn đã nhập sai nhiều lần. Vui lòng chờ ${lockCountdown} giây để thử lại.`);
      return;
    }

    const trimmed = studentPassword.trim();
    if (!trimmed) {
      setStudentError('Vui lòng nhập mật khẩu học sinh (ngày sinh dạng ddmmyyyy hoặc MSddmmyyyy).');
      return;
    }

    const authRes = authenticateStudentByPassword(trimmed, students);

    if (authRes.success && authRes.student) {
      setFailedAttempts(0);
      onLoginStudent(authRes.student.id);
    } else {
      const nextFail = failedAttempts + 1;
      setFailedAttempts(nextFail);
      if (nextFail >= 5) {
        setLockCountdown(30);
        setStudentError('Bạn đã nhập sai 5 lần liên tiếp. Hệ thống tạm khóa 30 giây để bảo mật.');
      } else {
        setStudentError(
          authRes.errorMessage ||
            'Mật khẩu không chính xác! Vui lòng nhập đúng 8 chữ số ngày sinh dạng ddmmyyyy hoặc MSddmmyyyy.'
        );
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-pink-200/90 flex flex-col">
        {/* Header banner với tông màu hồng phấn thanh lịch của lớp 6A8 */}
        <div className="bg-linear-to-b from-[#fff1f4] via-[#fce7ed] to-[#fadbe4] text-gray-900 p-6 sm:p-7 text-center relative overflow-hidden border-b border-pink-200/80">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-white/40 rounded-full blur-xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-6 -mb-6 w-28 h-28 bg-pink-300/20 rounded-full blur-lg pointer-events-none" />

          {/* Biểu tượng nón tú tài */}
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white text-pink-600 shadow-sm border border-pink-200/80 flex items-center justify-center ring-2 ring-pink-100/80">
            <GraduationCap className="w-8 h-8 text-pink-600 stroke-[2.2]" />
          </div>

          <h2 className="text-2xl font-black tracking-tight text-gray-900">
            {appName || 'SỔ CHỦ NHIỆM ĐIỆN TỬ'}
          </h2>
          <p className="text-xs text-gray-600 mt-1 font-medium">
            Hệ thống Quản lý Nề nếp &amp; Học tập Lớp học Toàn diện
          </p>

          {/* Badge lớp 6A8 & Năm học */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-pink-200 text-pink-800 text-xs font-bold shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-pink-500" />
            <span>Lớp {className} • Năm học {schoolYear}</span>
          </div>

          {/* Role selector tabs: Giáo viên và Học sinh */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/70 backdrop-blur-md rounded-2xl mt-5 border border-pink-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setActiveTab('teacher');
                setTeacherError('');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'teacher'
                  ? 'bg-white text-pink-800 shadow-xs border border-pink-200/60'
                  : 'text-gray-600 hover:text-pink-700 hover:bg-white/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-pink-600" />
              <span>Giáo viên</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('student');
                setStudentError('');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'student'
                  ? 'bg-white text-pink-800 shadow-xs border border-pink-200/60'
                  : 'text-gray-600 hover:text-pink-700 hover:bg-white/50'
              }`}
            >
              <User className="w-4 h-4 text-pink-600" />
              <span>Học sinh</span>
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="p-6 sm:p-7 bg-[#fffbfa]">
          {activeTab === 'teacher' ? (
            /* TAB GIÁO VIÊN */
            <form onSubmit={handleTeacherSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Mật khẩu Quản lý Giáo viên
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={teacherInputPass}
                    onChange={(e) => {
                      setTeacherInputPass(e.target.value);
                      setTeacherError('');
                    }}
                    placeholder="Nhập mật khẩu (Mặc định: 123)"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-pink-200/80 rounded-2xl text-sm font-medium text-gray-800 placeholder-gray-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-pink-400 focus:border-pink-400 transition-all shadow-xs"
                    autoFocus
                  />
                </div>
                {teacherError && (
                  <p className="text-xs text-rose-600 font-semibold mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{teacherError}</span>
                  </p>
                )}
                <div className="mt-2.5 flex items-center justify-between text-xs text-gray-400">
                  <span>Mật khẩu mặc định: <strong className="text-gray-700">123</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      setTeacherInputPass('123');
                      setTeacherError('');
                    }}
                    className="text-pink-600 hover:underline font-semibold cursor-pointer"
                  >
                    Điền nhanh 123
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-linear-to-r from-rose-500 via-pink-500 to-rose-500 hover:from-rose-600 hover:to-pink-600 active:scale-95 text-white font-bold text-sm rounded-2xl shadow-md shadow-pink-500/20 transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Đăng nhập quyền Quản lý</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          ) : (
            /* TAB HỌC SINH (Theo đúng mẫu 8A3 nhưng giữ màu hồng 6A8, duy nhất 1 ô mật khẩu) */
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  Chào mừng các em học sinh!
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  Nhập ngày sinh dạng ddmmyyyy để vào lớp
                </p>
              </div>

              <form onSubmit={handleStudentSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1.5 flex items-center gap-1.5">
                    <span>Mật khẩu học sinh (Ngày tháng năm sinh)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Calendar className="w-4 h-4 text-pink-500" />
                    </div>
                    <input
                      type="text"
                      inputMode="text"
                      autoComplete="off"
                      value={studentPassword}
                      onChange={(e) => {
                        setStudentPassword(e.target.value);
                        setStudentError('');
                      }}
                      disabled={lockCountdown > 0}
                      placeholder="Ví dụ: 05082012 hoặc 15052012"
                      className="w-full pl-10 pr-4 py-3 bg-white border border-pink-200/90 rounded-2xl text-sm font-bold text-gray-800 placeholder-gray-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-pink-400 focus:border-pink-400 transition-all shadow-xs disabled:bg-gray-100 disabled:opacity-60"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Hộp hướng dẫn nhập màu hồng nhẹ nhàng như mẫu 8A3 */}
                <div className="p-3.5 bg-pink-50/70 border border-pink-200/80 rounded-2xl text-xs text-pink-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-pink-900">
                    <HelpCircle className="w-4 h-4 text-pink-600 shrink-0" />
                    <span>Cách nhập mật khẩu học sinh:</span>
                  </div>
                  <p className="text-[11.5px] text-gray-700 leading-relaxed font-normal">
                    Nhập 8 chữ số ngày tháng năm sinh dạng <strong className="font-bold text-pink-900">ddmmyyyy</strong>. Ví dụ sinh ngày <strong className="font-bold text-gray-900">05/08/2012</strong> thì nhập <span className="px-1.5 py-0.5 bg-white border border-pink-300 rounded-md font-black text-pink-700">05082012</span> (hoặc có tiền tố <span className="px-1.5 py-0.5 bg-white border border-pink-300 rounded-md font-black text-pink-700">MS05082012</span>, giữ nguyên số 0 ở đầu).
                  </p>
                </div>

                {studentError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{studentError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={lockCountdown > 0}
                  className="w-full py-3.5 px-4 bg-linear-to-r from-rose-500 via-pink-500 to-rose-500 hover:from-rose-600 hover:to-pink-600 active:scale-95 text-white font-black text-sm rounded-2xl shadow-md shadow-pink-500/25 transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span>{lockCountdown > 0 ? `Vui lòng đợi ${lockCountdown}s...` : 'Đăng nhập Học sinh'}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>

              <div className="text-center pt-2 border-t border-pink-100">
                <span className="text-[11px] text-gray-400 font-medium">
                  Tận tâm đồng hành – Vững vàng chủ nhiệm
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

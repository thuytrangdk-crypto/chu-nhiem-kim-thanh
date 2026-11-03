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
      setStudentError('Vui lòng nhập mật khẩu học sinh gồm 10 chữ số.');
      return;
    }

    if (!/^\d+$/.test(trimmed)) {
      setStudentError('Mật khẩu chỉ bao gồm 10 chữ số (2 số mã HS + 8 số ngày sinh). Không chứa ký tự chữ cái hay tiền tố MS.');
      return;
    }

    if (trimmed.length !== 10) {
      setStudentError('Mật khẩu phải gồm đúng 10 chữ số: 2 số mã HS + 2 số ngày + 2 số tháng + 4 số năm sinh (Ví dụ: 0130112015).');
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
          authRes.errorMessage || 'Thông tin đăng nhập không chính xác'
        );
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#E5B2BD] flex flex-col">
        {/* Header banner với tông màu hồng pastel #EDB5C1 thanh lịch */}
        <div className="bg-linear-to-b from-[#FCF4F6] via-[#FAF0F3] to-[#F8E2E7] text-gray-900 p-6 sm:p-7 text-center relative overflow-hidden border-b border-[#E5B2BD]">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-white/40 rounded-full blur-xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-6 -mb-6 w-28 h-28 bg-[#EDB5C1]/20 rounded-full blur-lg pointer-events-none" />

          {/* Biểu tượng nón tú tài */}
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white text-[#1E293B] shadow-xs border border-[#EDB5C1] flex items-center justify-center ring-2 ring-[#FCF4F6]">
            <GraduationCap className="w-8 h-8 text-[#1E293B] stroke-[2.2]" />
          </div>

          <h2 className="text-2xl font-black tracking-tight text-[#1E293B]">
            {appName || 'SỔ CHỦ NHIỆM ĐIỆN TỬ'}
          </h2>
          <p className="text-xs text-slate-700 mt-1 font-semibold">
            Hệ thống Quản lý Nề nếp &amp; Học tập Lớp học Toàn diện
          </p>

          {/* Badge lớp 6A8 & Năm học */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-[#EDB5C1] text-[#1E293B] text-xs font-bold shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-[#C98292]" />
            <span>Lớp {className} • Năm học {schoolYear}</span>
          </div>

          {/* Role selector tabs: Giáo viên và Học sinh */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/80 backdrop-blur-md rounded-2xl mt-5 border border-[#E5B2BD] shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setActiveTab('teacher');
                setTeacherError('');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'teacher'
                  ? 'bg-[#EDB5C1] text-[#1E293B] font-black shadow-xs border border-[#E5B2BD]'
                  : 'text-gray-600 hover:text-[#1E293B] hover:bg-white/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-[#1E293B]" />
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
                  ? 'bg-[#EDB5C1] text-[#1E293B] font-black shadow-xs border border-[#E5B2BD]'
                  : 'text-gray-600 hover:text-[#1E293B] hover:bg-white/50'
              }`}
            >
              <User className="w-4 h-4 text-[#1E293B]" />
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
                    className="w-full pl-10 pr-4 py-3 bg-white border border-[#EDB5C1]/70 rounded-2xl text-sm font-medium text-gray-800 placeholder-gray-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] focus:border-[#EDB5C1] transition-all shadow-xs"
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
                    className="text-[#1E293B] hover:underline font-bold cursor-pointer"
                  >
                    Điền nhanh 123
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-[#EDB5C1] hover:bg-[#E4A7B4] active:scale-95 text-[#1E293B] font-black text-sm rounded-2xl shadow-md shadow-[#EDB5C1]/25 transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Đăng nhập quyền Quản lý</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-[#1E293B]" />
              </button>
            </form>
          ) : (
            /* TAB HỌC SINH (Công thức 10 chữ số: MMDDMMYYYY) */
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  Chào mừng các em học sinh!
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  Nhập mật khẩu 10 chữ số để vào lớp
                </p>
              </div>

              <form onSubmit={handleStudentSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1.5 flex items-center gap-1.5">
                    <span>Mật khẩu học sinh (Mã số + Ngày sinh)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Calendar className="w-4 h-4 text-[#C98292]" />
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={10}
                      value={studentPassword}
                      onChange={(e) => {
                        // Lưu mật khẩu dưới dạng chuỗi string, giữ nguyên các số 0 ở đầu
                        setStudentPassword(e.target.value);
                        setStudentError('');
                      }}
                      disabled={lockCountdown > 0}
                      placeholder="Ví dụ: 4129022015"
                      className="w-full pl-10 pr-4 py-3 bg-white border border-[#EDB5C1]/80 rounded-2xl text-sm font-bold text-gray-800 placeholder-gray-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] focus:border-[#EDB5C1] transition-all shadow-xs disabled:bg-gray-100 disabled:opacity-60"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Hộp hướng dẫn nhập theo đúng yêu cầu đề bài */}
                <div className="p-3.5 bg-[#FCF4F6] border border-[#EDB5C1] rounded-2xl text-xs text-[#1E293B] space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-[#1E293B]">
                    <HelpCircle className="w-4 h-4 text-[#C98292] shrink-0" />
                    <span>Cách nhập mật khẩu học sinh:</span>
                  </div>
                  <p className="text-[11.5px] text-gray-700 leading-relaxed font-normal">
                    Các em nhập mật khẩu gồm 10 chữ số: <strong className="font-bold text-[#1E293B]">2 số mã học sinh + 2 số ngày sinh + 2 số tháng sinh + 4 số năm sinh</strong>.
                  </p>
                  <p className="text-[11.5px] text-gray-700 leading-relaxed font-normal">
                    <span className="italic text-gray-500">(Ví dụ giả định)</span> Học sinh giả định có mã số <strong className="font-bold text-gray-900">41</strong>, sinh ngày <strong className="font-bold text-gray-900">29/02/2015</strong> thì nhập: <span className="px-1.5 py-0.5 bg-white border border-[#EDB5C1] rounded-md font-black text-[#1E293B]">4129022015</span>.
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
                  className="w-full py-3.5 px-4 bg-[#EDB5C1] hover:bg-[#E4A7B4] active:scale-95 text-[#1E293B] font-black text-sm rounded-2xl shadow-md shadow-[#EDB5C1]/25 transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span>{lockCountdown > 0 ? `Vui lòng đợi ${lockCountdown}s...` : 'Đăng nhập Học sinh'}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-[#1E293B]" />
                </button>
              </form>

              <div className="text-center pt-2 border-t border-[#EDB5C1]/30">
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

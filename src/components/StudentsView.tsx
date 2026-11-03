import React, { useState, useMemo } from 'react';
import { AppState, Student } from '../types';
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  Trash2,
  Search,
  Filter,
  Download,
  Upload,
  Eye,
  Edit2,
  MoreVertical,
  Check,
  AlertCircle,
  FileText,
  Star,
  Phone,
  LayoutGrid,
  List,
  UserMinus,
  AlertTriangle,
  X,
} from 'lucide-react';
import {
  calculateAverageGrade,
  calculateTotalPoints,
  exportStudentsToCsv,
  formatViDate,
  generateId,
  parseCsvStudents,
} from '../utils/helpers';
import { EmulationExportModal } from './EmulationExportModal';

interface StudentsViewProps {
  state: AppState;
  onSelectStudent: (id: string) => void;
  onAddStudent: (student: Partial<Student>) => void;
  onUpdateStudent: (student: Partial<Student>) => void;
  onDeleteStudent: (id: string) => void;
  onBatchImportStudents: (newStudents: Student[], mode: 'append' | 'replace') => void;
  onRemoveSampleStudents: () => void;
  onClearAllStudents: () => void;
  isTeacher: boolean;
  currentStudentId: string | null;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  state,
  onSelectStudent,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onBatchImportStudents,
  onRemoveSampleStudents,
  onClearAllStudents,
  isTeacher,
  currentStudentId,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'Nam' | 'Nữ'>('all');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [showAdminMenu, setShowAdminMenu] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEmulationExportOpen, setIsEmulationExportOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Add / Edit form state
  const [formData, setFormData] = useState<Partial<Student>>({
    name: '',
    dob: '2012-01-01',
    gender: 'Nam',
    position: 'Học sinh',
    phone: '',
    parentName: '',
    parentPhone: '',
    address: '',
    conduct: 'Tốt',
    notes: '',
  });

  // Batch import modal state
  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('replace');

  // Filter students
  const filteredStudents = useMemo(() => {
    return state.students.filter((s) => {
      const matchSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.parentPhone && s.parentPhone.includes(searchQuery));

      const matchGender =
        genderFilter === 'all' || s.gender === genderFilter;

      const matchPosition =
        positionFilter === 'all' ||
        (positionFilter === 'leader'
          ? s.position && s.position !== 'Học sinh'
          : s.position === positionFilter);

      return matchSearch && matchGender && matchPosition;
    });
  }, [state.students, searchQuery, genderFilter, positionFilter]);

  const handleOpenAdd = () => {
    setFormData({
      id: generateId(),
      name: '',
      dob: '2012-01-01',
      gender: 'Nam',
      position: 'Học sinh',
      phone: '',
      parentName: '',
      parentPhone: '',
      address: '',
      conduct: 'Tốt',
      password: '123',
    });
    setEditingStudent(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (s: Student) => {
    setFormData(s);
    setEditingStudent(s);
    setIsAddModalOpen(true);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      onShowToast('Vui lòng nhập họ và tên học sinh', 'error');
      return;
    }

    if (editingStudent) {
      onUpdateStudent(formData);
    } else {
      onAddStudent({
        ...formData,
        id: formData.id || generateId(),
      });
    }
    setIsAddModalOpen(false);
  };

  const handleExportCsv = () => {
    const csvData = exportStudentsToCsv(state.students);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Danh_sach_lop_${state.config.className}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast(`Đã xuất ${state.students.length} học sinh ra file CSV`);
  };

  const handleDownloadSampleCsv = () => {
    const sample = `STT,Mã định danh,Họ và tên,Ngày sinh,Giới tính,Chức vụ,SĐT Phụ huynh,Họ tên Phụ huynh,Địa chỉ
1,HS01,Nguyễn Văn An,2012-05-10,Nam,Lớp trưởng,0987111222,Nguyễn Văn Tuấn,Số 10 Kim Mã Ba Đình
2,HS02,Trần Thị Bình,2012-08-15,Nữ,Lớp phó học tập,0987333444,Trần Văn Hưng,Số 25 Cầu Giấy Hà Nội
3,HS03,Lê Hoàng Nam,2012-11-20,Nam,Học sinh,0987555666,Lê Văn Minh,Số 12 Thụy Khuê Tây Hồ`;

    const blob = new Blob(['\uFEFF' + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Mau_nhap_danh_sach_hoc_sinh.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast('Đã tải file mẫu CSV nhập học sinh');
  };

  const handleProcessImport = () => {
    if (!importText.trim()) {
      onShowToast('Vui lòng dán dữ liệu hoặc tải lên file CSV/TXT', 'error');
      return;
    }
    const parsed = parseCsvStudents(importText);
    if (parsed.length === 0) {
      onShowToast('Không nhận diện được dòng học sinh nào từ dữ liệu nhập', 'error');
      return;
    }

    const studentsToSave: Student[] = parsed.map((p) => ({
      id: p.id || generateId(),
      name: p.name || 'Học sinh',
      dob: p.dob || '2012-01-01',
      gender: p.gender || 'Nam',
      position: p.position || 'Học sinh',
      parentPhone: p.parentPhone || '',
      parentName: p.parentName || '',
      address: p.address || '',
      conduct: 'Tốt',
      password: '123',
    }));

    onBatchImportStudents(studentsToSave, importMode);
    setIsImportModalOpen(false);
    setImportText('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setImportText(text);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-3">
      {/* 8A3-Style Single Unified Toolbar - Bố cục chuẩn trên 1 hàng ngang duy nhất */}
      <div className="bg-white rounded-2xl p-2 sm:p-2.5 border border-gray-200/90 shadow-2xs flex items-center flex-nowrap overflow-x-auto no-scrollbar gap-1.5 xl:gap-2 w-full">
        {/* 1. Ô tìm kiếm học sinh gọn gàng */}
        <div className="relative w-36 sm:w-44 lg:w-48 xl:w-56 shrink-0">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm..."
            className="w-full h-9 pl-8 pr-6 bg-gray-50/80 focus:bg-white border border-gray-200 focus:border-[#EDB5C1] rounded-xl text-xs text-[#1E293B] placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]/30 transition-all font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* 2. Bộ lọc giới tính */}
        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value as any)}
          className="h-9 px-2 sm:px-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-[#1E293B] focus:outline-hidden focus:border-[#EDB5C1] cursor-pointer shadow-2xs shrink-0"
        >
          <option value="all">Tất cả giới tính</option>
          <option value="Nam">Nam</option>
          <option value="Nữ">Nữ</option>
        </select>

        {/* 3. Chuyển đổi dạng thẻ / danh sách */}
        <div className="h-9 flex items-center border border-gray-200 rounded-xl p-0.5 bg-gray-50/80 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`h-full px-2 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-white shadow-xs text-[#1E293B] font-black'
                : 'text-gray-400 hover:text-gray-600'
            }`}
            title="Dạng thẻ (5 học sinh / hàng)"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`h-full px-2 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white shadow-xs text-[#1E293B] font-black'
                : 'text-gray-400 hover:text-gray-600'
            }`}
            title="Dạng danh sách / bảng"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 4. Nút Xuất Excel */}
        <button
          type="button"
          onClick={handleExportCsv}
          className="h-9 px-2.5 xl:px-3 rounded-xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0 whitespace-nowrap"
          title="Xuất danh sách học sinh ra file CSV / Excel"
        >
          <Download className="w-3.5 h-3.5 text-emerald-700" />
          <span>Xuất Excel</span>
        </button>

        {/* 5. Nút Xuất Excel thi đua */}
        <button
          type="button"
          onClick={() => setIsEmulationExportOpen(true)}
          className="h-9 px-2.5 xl:px-3 rounded-xl border border-[#EDB5C1] bg-[#FCF4F6] hover:bg-[#F8E2E7] text-[#1E293B] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0 whitespace-nowrap"
          title="Xuất file Excel gồm 2 sheet Tổng hợp và Chi tiết thi đua"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-[#1E293B]" />
          <span>Xuất Excel thi đua</span>
        </button>

        {/* 6. Nút Nhập Excel */}
        {isTeacher && (
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="h-9 px-2.5 xl:px-3 rounded-xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0 whitespace-nowrap"
            title="Nhập danh sách học sinh từ file Excel hoặc CSV"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-700" />
            <span>Nhập Excel</span>
          </button>
        )}

        {/* 7. Nút + Thêm HS */}
        {isTeacher && (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="h-9 px-3 xl:px-3.5 rounded-xl bg-[#EDB5C1] hover:bg-[#E4A7B4] text-[#1E293B] font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 shrink-0 whitespace-nowrap"
            title="Thêm học sinh mới vào lớp 6A8"
          >
            <UserPlus className="w-3.5 h-3.5 text-[#1E293B]" />
            <span>+ Thêm HS</span>
          </button>
        )}

        {/* 8. Nút Làm sạch lớp */}
        {isTeacher && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowAdminMenu(!showAdminMenu)}
              className="h-9 px-2.5 xl:px-3 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
              title="Quản trị dữ liệu & làm sạch"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Làm sạch lớp</span>
            </button>

            {showAdminMenu && (
              <div className="absolute right-0 mt-1.5 w-60 bg-white border border-[#E5B2BD] rounded-2xl shadow-xl z-30 p-1.5 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminMenu(false);
                    if (window.confirm('Xóa 8 học sinh mẫu ban đầu và chỉ giữ lại học sinh thực tế của lớp?')) {
                      onRemoveSampleStudents();
                    }
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-[#FCF4F6] hover:text-[#1E293B] flex items-center gap-2 cursor-pointer"
                >
                  <UserMinus className="w-3.5 h-3.5 text-amber-600" />
                  <span>Xóa 8 học sinh mẫu ban đầu</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminMenu(false);
                    if (window.confirm('CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ học sinh của lớp? Thao tác này không thể hoàn tác!')) {
                      onClearAllStudents();
                    }
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Xóa toàn bộ danh sách lớp</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Students Data Display */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-200/80 shadow-xs">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-800">Không tìm thấy học sinh nào</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            {state.students.length === 0
              ? 'Lớp học chưa có học sinh. Cô hãy thêm học sinh hoặc nhập danh sách bằng file CSV/Excel.'
              : 'Thử kiểm tra lại từ khóa tìm kiếm hoặc điều chỉnh bộ lọc giới tính/chức vụ.'}
          </p>
          {isTeacher && state.students.length === 0 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-[#EDB5C1] hover:bg-[#E4A7B4] text-[#1E293B] font-black text-xs rounded-xl shadow-xs"
              >
                Thêm học sinh
              </button>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl"
              >
                Nhập từ Excel/CSV
              </button>
            </div>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FCF4F6] border-b border-[#E5B2BD] text-[#1E293B] font-black uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4 w-12 text-center">STT</th>
                  <th className="py-3.5 px-4">Họ và Tên</th>
                  <th className="py-3.5 px-4">Ngày sinh</th>
                  <th className="py-3.5 px-4">Giới tính</th>
                  <th className="py-3.5 px-4">Chức vụ</th>
                  <th className="py-3.5 px-4">ĐTB Môn</th>
                  <th className="py-3.5 px-4">Thi đua</th>
                  <th className="py-3.5 px-4">Liên hệ PH</th>
                  <th className="py-3.5 px-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredStudents.map((s, idx) => {
                  const avg = calculateAverageGrade(s.grades);
                  const points = calculateTotalPoints(state.discipline, s.id);
                  const isLeader = s.position && s.position !== 'Học sinh';

                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-[#FCF4F6]/50 transition-colors group"
                    >
                      <td className="py-3.5 px-4 text-center font-medium text-gray-400">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div
                          onClick={() => onSelectStudent(s.id)}
                          className="flex items-center gap-3 cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-xl bg-[#FCF4F6] text-[#1E293B] border border-[#EDB5C1] font-black flex items-center justify-center shrink-0 shadow-2xs">
                            {s.name.trim().charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 group-hover:text-pink-700 transition-colors">
                              {s.name}
                            </div>
                            <div className="text-[10px] text-gray-400">Mã: {s.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 font-medium">
                        {formatViDate(s.dob)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.gender === 'Nữ'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                              : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                          }`}
                        >
                          {s.gender}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isLeader
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {s.position || 'Học sinh'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {avg !== null ? (
                          <span
                            className={`font-black ${
                              avg >= 8.0
                                ? 'text-emerald-600'
                                : avg >= 6.5
                                ? 'text-blue-600'
                                : 'text-gray-700'
                            }`}
                          >
                            {avg}
                          </span>
                        ) : (
                          <span className="text-gray-300">--</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-black text-[#1E293B]">
                          +{points} đ
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {s.parentPhone ? (
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                            <span>{s.parentPhone}</span>
                          </div>
                        ) : (
                          <span className="text-gray-300">--</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onSelectStudent(s.id)}
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-indigo-100 text-gray-600 hover:text-indigo-600 transition-colors"
                            title="Xem chi tiết hồ sơ"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isTeacher && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(s)}
                                className="p-1.5 rounded-lg bg-gray-100 hover:bg-amber-100 text-gray-600 hover:text-amber-600 transition-colors"
                                title="Sửa thông tin"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Bạn có chắc muốn xóa học sinh "${s.name}"?`
                                    )
                                  ) {
                                    onDeleteStudent(s.id);
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-gray-100 hover:bg-rose-100 text-gray-600 hover:text-rose-600 transition-colors"
                                title="Xóa học sinh"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARD GRID VIEW: 5 CARDS PER ROW ON DESKTOP (CLASS 8A3 STYLE) */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-3 sm:gap-3.5">
          {filteredStudents.map((s) => {
            const studentDisciplines = state.discipline.filter((d) => d.studentId === s.id);
            const infractionsCount = studentDisciplines.filter((d) => d.type === 'minus').length;
            const points = calculateTotalPoints(state.discipline, s.id);
            const pointsFormatted = points >= 0 ? `+${points} đ` : `${points} đ`;

            // Attendance label for today
            const todayStr = new Date().toISOString().substring(0, 10);
            const todayAttendance = state.attendance.find(
              (a) => a.studentId === s.id && a.date === todayStr
            );
            let attendanceLabel = 'Chưa ĐD';
            let attendanceColor = 'text-gray-400 font-medium';
            if (todayAttendance) {
              if (todayAttendance.status === 'c') {
                attendanceLabel = 'Có mặt';
                attendanceColor = 'text-emerald-700 font-bold';
              } else if (todayAttendance.status === 'v') {
                attendanceLabel = 'Có phép';
                attendanceColor = 'text-blue-600 font-bold';
              } else if (todayAttendance.status === 'kp') {
                attendanceLabel = 'Không phép';
                attendanceColor = 'text-rose-600 font-bold';
              } else if (todayAttendance.status === 'm') {
                attendanceLabel = 'Đi muộn';
                attendanceColor = 'text-amber-600 font-bold';
              }
            }

            // Avatar initial: letter of student name (Class 8A3 style)
            const initialLetter = s.name.trim().charAt(0).toUpperCase();

            return (
              <div
                key={s.id}
                onClick={() => onSelectStudent(s.id)}
                className="bg-white rounded-2xl p-3 sm:p-3.5 border border-gray-200/90 shadow-2xs hover:border-[#EDB5C1] hover:shadow-md transition-all flex flex-col items-center justify-between relative cursor-pointer group text-center select-none"
              >
                {/* Warning indicator at top right if student has infractions or attendance alert */}
                {infractionsCount > 0 && (
                  <div
                    className="absolute top-2 right-2 w-5 h-5 rounded-md bg-rose-600 text-white flex items-center justify-center shadow-xs"
                    title={`${infractionsCount} lần vi phạm nề nếp`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 fill-white text-rose-600" />
                  </div>
                )}

                {/* Avatar with initial letter */}
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#FCF4F6] text-[#1E293B] border border-[#EDB5C1] flex items-center justify-center text-xl sm:text-2xl font-black mb-2 shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                  {initialLetter}
                </div>

                {/* Full Name: Bold, uppercase, max 2 lines */}
                <h4 className="font-black text-xs sm:text-sm text-[#1E293B] uppercase tracking-tight line-clamp-2 min-h-[2.25rem] flex items-center justify-center group-hover:text-pink-700 transition-colors leading-snug">
                  {s.name}
                </h4>

                {/* Gender • Date of birth */}
                <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold mt-1">
                  <span
                    className={
                      s.gender === 'Nữ'
                        ? 'text-pink-600 font-bold'
                        : 'text-blue-600 font-bold'
                    }
                  >
                    {s.gender}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="text-gray-500 font-medium">
                    {formatViDate(s.dob)}
                  </span>
                </div>

                {/* Bottom line: Attendance status + Points or Warning count */}
                <div className="w-full mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px]">
                  <span className={attendanceColor}>{attendanceLabel}</span>
                  {infractionsCount > 0 ? (
                    <span
                      className="text-rose-600 font-bold flex items-center gap-0.5"
                      title={`${infractionsCount} vi phạm nề nếp`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>{infractionsCount}</span>
                    </span>
                  ) : (
                    <span className="font-bold text-[#1E293B]">{pointsFormatted}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: ADD / EDIT STUDENT */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-[#E5B2BD] flex items-center justify-between bg-[#EDB5C1] text-[#1E293B]">
              <h3 className="font-black text-base">
                {editingStudent ? 'Chỉnh Sửa Hồ Sơ Học Sinh' : 'Thêm Mới Học Sinh'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#1E293B] hover:opacity-70 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Họ và Tên Học Sinh *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nguyễn Văn An"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Ngày Sinh *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dob || '2012-01-01'}
                    onChange={(e) => {
                      const newDob = e.target.value;
                      setFormData({
                        ...formData,
                        dob: newDob,
                        password: formatViDate(newDob) || newDob,
                      });
                    }}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] font-semibold"
                  />
                  <p className="text-[10px] text-[#1E293B] mt-1 font-semibold">
                    Mật khẩu đăng nhập mặc định: <strong>{formatViDate(formData.dob || '2012-01-01')}</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Giới Tính
                  </label>
                  <select
                    value={formData.gender || 'Nam'}
                    onChange={(e) =>
                      setFormData({ ...formData, gender: e.target.value as any })
                    }
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Chức Vụ Trong Lớp
                  </label>
                  <select
                    value={formData.position || 'Học sinh'}
                    onChange={(e) =>
                      setFormData({ ...formData, position: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]"
                  >
                    <option value="Học sinh">Học sinh</option>
                    <option value="Lớp trưởng">Lớp trưởng</option>
                    <option value="Lớp phó học tập">Lớp phó học tập</option>
                    <option value="Lớp phó lao động">Lớp phó lao động</option>
                    <option value="Lớp phó Văn-Thể-Mỹ">Lớp phó Văn-Thể-Mỹ</option>
                    <option value="Bí thư Chi đội">Bí thư Chi đội</option>
                    <option value="Tổ trưởng Tổ 1">Tổ trưởng Tổ 1</option>
                    <option value="Tổ trưởng Tổ 2">Tổ trưởng Tổ 2</option>
                    <option value="Tổ trưởng Tổ 3">Tổ trưởng Tổ 3</option>
                    <option value="Tổ trưởng Tổ 4">Tổ trưởng Tổ 4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    SĐT Phụ Huynh
                  </label>
                  <input
                    type="text"
                    value={formData.parentPhone || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, parentPhone: e.target.value })
                    }
                    placeholder="0912345678"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Họ Tên Phụ Huynh
                  </label>
                  <input
                    type="text"
                    value={formData.parentName || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, parentName: e.target.value })
                    }
                    placeholder="Bố/Mẹ em..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Địa Chỉ Thường Trú
                  </label>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="Số nhà, ngõ, đường, quận/huyện..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold text-xs hover:bg-gray-50 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#EDB5C1] hover:bg-[#E4A7B4] text-[#1E293B] font-black text-xs shadow-md shadow-[#EDB5C1]/20 cursor-pointer"
                >
                  {editingStudent ? 'Cập nhật' : 'Thêm học sinh'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BATCH IMPORT CSV / EXCEL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[92vh]">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-emerald-600 text-white">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                <h3 className="font-bold text-base">Nhập Danh Sách Học Sinh Lớp</h3>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-emerald-200 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-emerald-600" />
                  <span>Hướng dẫn nhập dữ liệu học sinh:</span>
                </div>
                <p>
                  Cô có thể tải lên file <strong>.csv</strong> hoặc sao chép (copy) trực tiếp danh sách từ Excel rồi dán vào ô bên dưới. Thứ tự các cột: <em>STT, Họ tên, Ngày sinh, Giới tính, Chức vụ, SĐT Phụ huynh</em>.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline pt-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải file mẫu Excel / CSV chuẩn</span>
                </button>
              </div>

              {/* Upload file or paste text */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                  Tải lên File CSV / TXT
                </label>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="block w-full text-xs text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                  Hoặc Dán Nội Dung Bảng Từ Excel / CSV
                </label>
                <textarea
                  rows={8}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`1,Nguyễn Văn An,2012-05-10,Nam,Lớp trưởng,0987111222\n2,Trần Thị Bình,2012-08-15,Nữ,Lớp phó học tập,0987333444`}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Mode: Replace or Append */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2">
                <span className="block text-xs font-bold text-gray-800">
                  Phương thức nhập:
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                      importMode === 'replace'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold'
                        : 'bg-white border-gray-200 text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                    />
                    <div className="text-xs">
                      <div>Thay thế toàn bộ lớp</div>
                      <div className="text-[10px] text-gray-500 font-normal">
                        Xóa danh sách cũ, chỉ giữ danh sách mới nhập
                      </div>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                      importMode === 'append'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold'
                        : 'bg-white border-gray-200 text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                    />
                    <div className="text-xs">
                      <div>Thêm vào lớp (Nối tiếp)</div>
                      <div className="text-[10px] text-gray-500 font-normal">
                        Giữ học sinh hiện có và thêm các học sinh mới
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold text-xs hover:bg-gray-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleProcessImport}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
                >
                  Xác nhận Nhập Học Sinh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xuất Excel Thi Đua */}
      {isEmulationExportOpen && (
        <EmulationExportModal
          isOpen={isEmulationExportOpen}
          onClose={() => setIsEmulationExportOpen(false)}
          state={state}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};

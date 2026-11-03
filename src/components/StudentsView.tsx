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
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

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
    <div className="space-y-5">
      {/* Top Header & Actions Bar */}
      <div className="bg-white rounded-3xl p-4 lg:p-6 border border-gray-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span>Danh Sách Học Sinh</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              {state.students.length} em
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Quản lý hồ sơ học bạ, thông tin liên lạc phụ huynh và nề nếp thi đua
          </p>
        </div>

        {/* Buttons for Teacher */}
        {isTeacher && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenAdd}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Thêm học sinh</span>
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Nhập Excel / CSV</span>
            </button>
            <button
              onClick={() => setIsEmulationExportOpen(true)}
              className="px-3.5 py-2 bg-[#EDB5C1] hover:bg-[#E4A7B4] text-[#1E293B] font-black text-xs rounded-xl shadow-xs shadow-[#EDB5C1]/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Xuất file Excel gồm 2 sheet Tổng hợp và Chi tiết thi đua của lớp"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#1E293B]" />
              <span>Xuất Excel thi đua</span>
            </button>
            <button
              onClick={handleExportCsv}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Xuất file CSV"
            >
              <Download className="w-4 h-4 text-gray-600" />
              <span>Xuất CSV</span>
            </button>
            {/* Remove sample 8 students button */}
            <button
              onClick={() => {
                if (window.confirm('Xóa 8 học sinh mẫu ban đầu và chỉ giữ lại học sinh thực tế của lớp?')) {
                  onRemoveSampleStudents();
                }
              }}
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Xóa 8 học sinh mẫu"
            >
              <UserMinus className="w-4 h-4 text-amber-600" />
              <span>Xóa 8 em mẫu</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-3.5 lg:p-4 border border-gray-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên học sinh, mã HS, SĐT phụ huynh..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Gender filter */}
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value as any)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">Tất cả giới tính</option>
            <option value="Nam">Nam</option>
            <option value="Nữ">Nữ</option>
          </select>

          {/* Position filter */}
          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">Tất cả chức vụ</option>
            <option value="leader">Ban Cán Sự Lớp</option>
            <option value="Lớp trưởng">Lớp trưởng</option>
            <option value="Lớp phó học tập">Lớp phó học tập</option>
            <option value="Bí thư Chi đội">Bí thư</option>
            <option value="Học sinh">Học sinh</option>
          </select>

          {/* View toggle */}
          <div className="flex items-center border border-gray-200 rounded-xl p-0.5 bg-gray-50">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg ${
                viewMode === 'table' ? 'bg-white shadow-xs text-indigo-600' : 'text-gray-400'
              }`}
              title="Dạng bảng"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg ${
                viewMode === 'cards' ? 'bg-white shadow-xs text-indigo-600' : 'text-gray-400'
              }`}
              title="Dạng thẻ"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
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
                className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl"
              >
                Thêm học sinh
              </button>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl"
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
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
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
                      className="hover:bg-indigo-50/40 transition-colors group"
                    >
                      <td className="py-3.5 px-4 text-center font-medium text-gray-400">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div
                          onClick={() => onSelectStudent(s.id)}
                          className="flex items-center gap-3 cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-xl bg-linear-to-tr from-indigo-500 to-violet-500 text-white font-bold flex items-center justify-center shrink-0 shadow-xs">
                            {s.name.charAt(s.name.lastIndexOf(' ') + 1) || s.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
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
                        <span className="font-black text-indigo-600">
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
        /* CARD GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredStudents.map((s) => {
            const avg = calculateAverageGrade(s.grades);
            const points = calculateTotalPoints(state.discipline, s.id);
            const isLeader = s.position && s.position !== 'Học sinh';

            return (
              <div
                key={s.id}
                className="bg-white rounded-3xl p-4 border border-gray-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-indigo-500 to-violet-500 text-white font-bold flex items-center justify-center shrink-0 shadow-xs">
                        {s.name.charAt(s.name.lastIndexOf(' ') + 1) || s.name.charAt(0)}
                      </div>
                      <div>
                        <h4
                          onClick={() => onSelectStudent(s.id)}
                          className="font-bold text-sm text-gray-900 hover:text-indigo-600 cursor-pointer transition-colors"
                        >
                          {s.name}
                        </h4>
                        <p className="text-[10px] text-gray-400">Mã: {s.id}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.gender === 'Nữ'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {s.gender}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-600 mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Chức vụ:</span>
                      <span className={`font-semibold ${isLeader ? 'text-amber-700' : 'text-gray-700'}`}>
                        {s.position || 'Học sinh'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Ngày sinh:</span>
                      <span className="font-medium">{formatViDate(s.dob)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">ĐTB Môn:</span>
                      <span className="font-bold text-indigo-600">
                        {avg !== null ? avg : '--'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Thi đua:</span>
                      <span className="font-bold text-emerald-600">
                        +{points} đ
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onSelectStudent(s.id)}
                    className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-colors text-center"
                  >
                    Xem hồ sơ
                  </button>
                  {isTeacher && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(s)}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                        title="Sửa"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Xóa học sinh "${s.name}"?`)) {
                            onDeleteStudent(s.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                        title="Xóa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
              <h3 className="font-bold text-base">
                {editingStudent ? 'Chỉnh Sửa Hồ Sơ Học Sinh' : 'Thêm Mới Học Sinh'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-indigo-200 hover:text-white text-lg font-bold"
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
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold text-xs hover:bg-gray-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20"
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

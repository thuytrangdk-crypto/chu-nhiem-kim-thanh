import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState, BoardNotice, NoticeVideo, NoticeLink } from '../types';
import {
  Megaphone,
  Pin,
  Plus,
  Trash2,
  Calendar,
  User,
  Grid3X3,
  Trophy,
  GraduationCap,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Star,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Image as ImageIcon,
  Video as VideoIcon,
  Link as LinkIcon,
  Edit2,
  Search,
  Upload,
  Play,
  Eye,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { generateId, getTodayStr, calculateAverageGrade, calculateTotalPoints } from '../utils/helpers';
import { getEmulationConfigForClass, evaluateStudentEmulation } from '../utils/emulationEvaluation';

interface BoardViewProps {
  state: AppState;
  onAddNotice: (notice: Omit<BoardNotice, 'id'>) => void;
  onUpdateNotice?: (notice: BoardNotice) => void;
  onDeleteNotice: (id: string) => void;
  onUpdateSeatingChart: (newChart: Record<string, string>) => void;
  onSelectStudent: (id: string) => void;
  isTeacher: boolean;
  authStudentId?: string | null;
  activeTab?: 'notices' | 'seating' | 'honor';
  onTabChange?: (tab: 'notices' | 'seating' | 'honor') => void;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

// Client-side image compression: converts to max 1280px WebP/JPEG ~80-180KB
const compressImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1280;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(img.src);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// YouTube ID extractor
const extractYouTubeId = (url: string): string | null => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

// URL validator
const isValidUrl = (str: string): boolean => {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

export const BoardView: React.FC<BoardViewProps> = ({
  state,
  onAddNotice,
  onUpdateNotice,
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

  // Format teacher signature
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

  // Notice search & category filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Lightbox state
  const [lightbox, setLightbox] = useState<{
    isOpen: boolean;
    images: string[];
    index: number;
    title?: string;
  }>({
    isOpen: false,
    images: [],
    index: 0,
  });

  const openLightbox = (images: string[], index: number, title?: string) => {
    setLightbox({
      isOpen: true,
      images,
      index,
      title,
    });
  };

  const closeLightbox = () => {
    setLightbox((prev) => ({ ...prev, isOpen: false }));
  };

  const prevLightboxImage = () => {
    setLightbox((prev) => ({
      ...prev,
      index: (prev.index - 1 + prev.images.length) % prev.images.length,
    }));
  };

  const nextLightboxImage = () => {
    setLightbox((prev) => ({
      ...prev,
      index: (prev.index + 1) % prev.images.length,
    }));
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightbox.isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prevLightboxImage();
      if (e.key === 'ArrowRight') nextLightboxImage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightbox.isOpen, lightbox.images.length]);

  // Notice Creation / Edit Modal State
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [activeMediaTab, setActiveMediaTab] = useState<'images' | 'videos' | 'links'>('images');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Thông báo');
  const [priority, setPriority] = useState<'high' | 'normal' | 'info'>('normal');
  const [pinned, setPinned] = useState(false);
  const [author, setAuthor] = useState(getTeacherSignature(state.config.teacherName));

  // Attached media states
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [attachedVideos, setAttachedVideos] = useState<NoticeVideo[]>([]);
  const [attachedLinks, setAttachedLinks] = useState<NoticeLink[]>([]);
  const [isCompressingImages, setIsCompressingImages] = useState(false);

  // Temporary inputs for media tabs
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [videoTitleInput, setVideoTitleInput] = useState('');
  const [linkTitleInput, setLinkTitleInput] = useState('');
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkDescInput, setLinkDescInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  // Open modal for NEW notice
  const handleOpenAddNotice = () => {
    setEditingNoticeId(null);
    setTitle('');
    setContent('');
    setCategory('Thông báo');
    setPriority('normal');
    setPinned(false);
    setAuthor(getTeacherSignature(state.config.teacherName));
    setAttachedImages([]);
    setAttachedVideos([]);
    setAttachedLinks([]);
    setActiveMediaTab('images');
    setIsPreviewOpen(false);
    setIsNoticeModalOpen(true);
  };

  // Open modal for EDITING notice
  const handleOpenEditNotice = (n: BoardNotice) => {
    setEditingNoticeId(n.id);
    setTitle(n.title);
    setContent(n.content);
    setCategory(n.category || (n.priority === 'high' ? 'Khẩn' : n.priority === 'info' ? 'Nhắc nhở' : 'Thông báo'));
    setPriority(n.priority);
    setPinned(n.pinned);
    setAuthor(n.author || getTeacherSignature(state.config.teacherName));
    setAttachedImages(n.images || []);
    setAttachedVideos(n.videos || []);
    setAttachedLinks(n.links || []);
    setActiveMediaTab('images');
    setIsPreviewOpen(false);
    setIsNoticeModalOpen(true);
  };

  // Handle image files selection / drag-and-drop
  const handleImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsCompressingImages(true);
    const newImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      try {
        const compressed = await compressImageFile(file);
        newImages.push(compressed);
      } catch (err) {
        console.error('Lỗi nén ảnh:', err);
      }
    }
    setAttachedImages((prev) => [...prev, ...newImages]);
    setIsCompressingImages(false);
  };

  // Handle video file upload
  const handleVideoFile = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('video/')) {
      onShowToast('Vui lòng chọn tệp video hợp lệ (MP4, WebM)', 'error');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      onShowToast('Video vượt quá dung lượng cho phép (tối đa 50MB)', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      if (url) {
        setAttachedVideos((prev) => [
          ...prev,
          {
            id: generateId(),
            url,
            title: file.name,
            type: 'upload',
          },
        ]);
        onShowToast(`Đã thêm video: ${file.name}`);
      }
    };
    reader.readAsDataURL(file);
  };

  // Add video via YouTube link
  const handleAddVideoUrl = () => {
    const trimmed = videoUrlInput.trim();
    if (!trimmed) return;
    const ytId = extractYouTubeId(trimmed);
    if (!ytId && !isValidUrl(trimmed)) {
      onShowToast('Vui lòng nhập đường link video hoặc link YouTube hợp lệ', 'error');
      return;
    }
    setAttachedVideos((prev) => [
      ...prev,
      {
        id: generateId(),
        url: trimmed,
        title: videoTitleInput.trim() || 'Video YouTube',
        type: ytId ? 'youtube' : 'upload',
      },
    ]);
    setVideoUrlInput('');
    setVideoTitleInput('');
    onShowToast('Đã thêm liên kết video vào thông báo');
  };

  // Add link
  const handleAddLink = () => {
    const trimmedUrl = linkUrlInput.trim();
    const trimmedTitle = linkTitleInput.trim();
    if (!trimmedTitle) {
      onShowToast('Vui lòng nhập tên hiển thị cho liên kết', 'error');
      return;
    }
    if (!isValidUrl(trimmedUrl)) {
      onShowToast('URL không hợp lệ. Vui lòng bắt đầu bằng http:// hoặc https://', 'error');
      return;
    }
    setAttachedLinks((prev) => [
      ...prev,
      {
        id: generateId(),
        title: trimmedTitle,
        url: trimmedUrl,
        description: linkDescInput.trim() || undefined,
      },
    ]);
    setLinkTitleInput('');
    setLinkUrlInput('');
    setLinkDescInput('');
    onShowToast('Đã thêm liên kết tài liệu/website');
  };

  // Save notice (Create or Update)
  const handleSaveNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      onShowToast('Vui lòng nhập tiêu đề thông báo', 'error');
      return;
    }
    if (!content.trim()) {
      onShowToast('Vui lòng nhập nội dung chi tiết', 'error');
      return;
    }

    if (editingNoticeId) {
      // Update existing
      if (onUpdateNotice) {
        onUpdateNotice({
          id: editingNoticeId,
          title: title.trim(),
          content: content.trim(),
          category,
          priority,
          pinned,
          author: author.trim() || getTeacherSignature(state.config.teacherName),
          date: getTodayStr(),
          images: attachedImages,
          videos: attachedVideos,
          links: attachedLinks,
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      // Create new
      onAddNotice({
        title: title.trim(),
        content: content.trim(),
        category,
        priority,
        pinned,
        author: author.trim() || getTeacherSignature(state.config.teacherName),
        date: getTodayStr(),
        images: attachedImages,
        videos: attachedVideos,
        links: attachedLinks,
        updatedAt: new Date().toISOString(),
      });
    }

    setIsNoticeModalOpen(false);
  };

  // Seating assignment modal & controls
  const [assigningDeskKey, setAssigningDeskKey] = useState<string | null>(null);
  const seatingChart = state.seatingChart || {};

  const handleAssignStudent = (deskKey: string, studentId: string | '') => {
    const updated = { ...seatingChart };
    if (!studentId) {
      delete updated[deskKey];
    } else {
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

  // Sort & filter notices
  const sortedAndFilteredNotices = useMemo(() => {
    let list = [...state.boardNotices];

    // Filter by category
    if (selectedCategory !== 'all') {
      list = list.filter((n) => {
        const cat = n.category || (n.priority === 'high' ? 'Khẩn' : n.priority === 'info' ? 'Nhắc nhở' : 'Thông báo');
        return cat.toLowerCase() === selectedCategory.toLowerCase();
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
      );
    }

    // Pinned first, then newest date
    return list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.date || '').localeCompare(a.date || '');
    });
  }, [state.boardNotices, selectedCategory, searchQuery]);

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

  // Check if current authenticated student has a seat
  const currentStudentDeskKey = useMemo(() => {
    if (!authStudentId) return null;
    return Object.keys(seatingChart).find((key) => seatingChart[key] === authStudentId) || null;
  }, [authStudentId, seatingChart]);

  return (
    <div className="space-y-4">
      {/* 1. TOP SUB-TABS NAVIGATION & "+ ĐĂNG THÔNG TIN MỚI" (THEO MẪU 8A3 CHUẨN) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-transparent">
        {/* Ba tab nằm trên cùng 1 hàng */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => handleTabChange('notices')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === 'notices'
                ? 'bg-[#EDB5C1] text-[#1E293B] shadow-md shadow-[#EDB5C1]/20 font-black border border-[#E5B2BD]'
                : 'bg-white text-slate-700 hover:bg-[#FCF4F6] hover:text-[#1E293B] border border-gray-200/80 shadow-2xs'
            }`}
          >
            <Megaphone className="w-4 h-4 shrink-0 text-[#1E293B]" />
            <span>Bảng tin Thông báo</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('seating')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === 'seating'
                ? 'bg-[#EDB5C1] text-[#1E293B] shadow-md shadow-[#EDB5C1]/20 font-black border border-[#E5B2BD]'
                : 'bg-white text-slate-700 hover:bg-[#FCF4F6] hover:text-[#1E293B] border border-gray-200/80 shadow-2xs'
            }`}
          >
            <Grid3X3 className="w-4 h-4 shrink-0 text-[#1E293B]" />
            <span>Sơ đồ lớp</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('honor')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === 'honor'
                ? 'bg-[#EDB5C1] text-[#1E293B] shadow-md shadow-[#EDB5C1]/20 font-black border border-[#E5B2BD]'
                : 'bg-white text-slate-700 hover:bg-[#FCF4F6] hover:text-[#1E293B] border border-gray-200/80 shadow-2xs'
            }`}
          >
            <Trophy className="w-4 h-4 shrink-0 text-[#1E293B]" />
            <span>Vinh danh & Thi đua</span>
          </button>
        </div>

        {/* Nút "+ Đăng thông tin mới" bên phải (Chỉ dành cho Giáo viên) */}
        {isTeacher && activeTab === 'notices' && (
          <button
            type="button"
            onClick={handleOpenAddNotice}
            className="self-start sm:self-auto px-4 py-2.5 bg-[#EDB5C1] hover:bg-[#E4A7B4] active:scale-95 text-[#1E293B] font-black text-xs sm:text-sm rounded-2xl shadow-sm shadow-[#EDB5C1]/25 border border-[#E5B2BD] transition-all flex items-center gap-2 cursor-pointer shrink-0"
            title="Đăng thông báo mới kèm nhiều ảnh, video và liên kết"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Đăng thông tin mới</span>
          </button>
        )}
      </div>

      {/* TAB 1: BẢNG TIN THÔNG BÁO (BỐ CỤC 2 CỘT 70/30 THEO MẪU 8A3) */}
      {activeTab === 'notices' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
          {/* CỘT TRÁI (~70%): BẢNG TIN CHÍNH */}
          <div className="lg:col-span-8 space-y-3.5">
            {/* Header Box Trang thông tin (gọn gàng, thanh lịch theo mẫu 8A3) */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border border-gray-200/80 shadow-2xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#FCF4F6] border border-[#EDB5C1]/60 flex items-center justify-center text-[#1E293B] shrink-0 shadow-2xs">
                  <Megaphone className="w-5 h-5 text-[#1E293B]" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-[#1E293B] tracking-tight">
                    Trang thông tin & Bảng tin Lớp {state.config.className || '6A8'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Các thông báo, kế hoạch và nhắc nhở từ GVCN đến lớp
                  </p>
                </div>
              </div>
            </div>

            {/* Thanh tìm kiếm & bộ lọc danh mục thông báo */}
            <div className="flex items-center gap-2 bg-white rounded-2xl p-2 border border-gray-200/80 shadow-2xs">
              <div className="relative flex-1 min-w-[140px]">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm thông báo..."
                  className="w-full pl-8 pr-6 py-1.5 text-xs bg-gray-50/80 focus:bg-white border border-gray-200 focus:border-[#EDB5C1] rounded-xl text-[#1E293B] focus:outline-hidden transition-all"
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

              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'Thông báo', label: 'Thông báo' },
                  { id: 'Khen thưởng', label: 'Khen thưởng' },
                  { id: 'Kế hoạch', label: 'Kế hoạch' },
                  { id: 'Nhắc nhở', label: 'Nhắc nhở' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                      selectedCategory === cat.id
                        ? 'bg-[#EDB5C1] text-[#1E293B] shadow-2xs'
                        : 'bg-gray-100/70 text-slate-600 hover:bg-gray-200/70'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Danh sách thẻ thông báo */}
            <div className="space-y-3.5">
              {sortedAndFilteredNotices.length === 0 ? (
                <div className="bg-white rounded-3xl p-10 text-center border border-gray-200/80 shadow-2xs">
                  <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-2.5" />
                  <h3 className="text-sm font-bold text-gray-800">
                    {searchQuery || selectedCategory !== 'all'
                      ? 'Không tìm thấy thông báo phù hợp'
                      : 'Bảng tin chưa có thông báo'}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    {isTeacher
                      ? 'Cô bấm nút "+ Đăng thông tin mới" ở góc trên để gửi dặn dò, hình ảnh và tài liệu cho lớp.'
                      : 'Các thông báo dặn dò của cô chủ nhiệm sẽ hiển thị tại đây.'}
                  </p>
                </div>
              ) : (
                sortedAndFilteredNotices.map((n) => {
                  const isHigh = n.priority === 'high';
                  const isInfo = n.priority === 'info';
                  const catLabel = n.category || (isHigh ? 'Khẩn' : isInfo ? 'Nhắc nhở' : 'Thông báo');
                  const images = n.images || [];
                  const videos = n.videos || [];
                  const links = n.links || [];

                  return (
                    <article
                      key={n.id}
                      className={`bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border shadow-2xs hover:shadow-xs transition-all relative overflow-hidden ${
                        n.pinned
                          ? 'border-[#EDB5C1] ring-2 ring-[#EDB5C1]/25'
                          : 'border-gray-200/90'
                      }`}
                    >
                      {/* Dòng 1: Tiêu đề nổi bật, nhãn phân loại, trạng thái ghim, nút chỉnh sửa và xóa */}
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          {/* Left icon / pin badge */}
                          {n.pinned ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                              <Pin className="w-3.5 h-3.5 fill-rose-600" />
                              <span>Ghim</span>
                            </span>
                          ) : (
                            <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                          )}

                          <h3 className="font-black text-[#1E293B] text-sm sm:text-base tracking-tight leading-snug">
                            {n.title}
                          </h3>

                          {/* Nhãn phân loại nhẹ nhàng */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              catLabel === 'Khen thưởng'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : catLabel === 'Khẩn' || isHigh
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : catLabel === 'Nhắc nhở' || isInfo
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-[#FCF4F6] text-[#1E293B] border border-[#EDB5C1]/60'
                            }`}
                          >
                            {catLabel}
                          </span>
                        </div>

                        {/* Nút thao tác dành cho Giáo viên: Thay đổi & Xóa (theo đúng mẫu 8A3) */}
                        {isTeacher && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditNotice(n)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold text-slate-700 bg-gray-50 hover:bg-[#FCF4F6] hover:text-[#1E293B] border border-gray-200/80 transition-all cursor-pointer shadow-2xs"
                              title="Chỉnh sửa nội dung & tệp đính kèm"
                            >
                              <Edit2 className="w-3 h-3 text-[#1E293B]" />
                              <span>Thay đổi</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Bạn có chắc muốn xóa thông báo "${n.title}"?`)) {
                                  onDeleteNotice(n.id);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold text-rose-700 bg-rose-50/70 hover:bg-rose-100 border border-rose-200/80 transition-all cursor-pointer shadow-2xs"
                              title="Xóa thông báo"
                            >
                              <Trash2 className="w-3 h-3 text-rose-600" />
                              <span>Xóa</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Dòng 2: Nội dung thông báo rõ ràng, dễ đọc, tự động xuống dòng */}
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line mb-3.5">
                        {n.content}
                      </p>

                      {/* Dòng 3: Hình ảnh, video hoặc đường link đính kèm */}
                      {/* A. Lưới hiển thị nhiều hình ảnh (1, 2, 3, 4, 5+ ảnh có lightbox) */}
                      {images.length > 0 && (
                        <div className="mb-3.5">
                          {images.length === 1 && (
                            <div
                              onClick={() => openLightbox(images, 0, n.title)}
                              className="rounded-2xl overflow-hidden border border-gray-200/80 max-h-96 cursor-pointer group relative bg-gray-50 flex items-center justify-center"
                            >
                              <img
                                src={images[0]}
                                alt={n.title}
                                className="w-full h-auto max-h-96 object-contain group-hover:scale-[1.01] transition-transform"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <span className="p-2 rounded-full bg-black/60 backdrop-blur-xs">
                                  <Eye className="w-5 h-5" />
                                </span>
                              </div>
                            </div>
                          )}

                          {images.length === 2 && (
                            <div className="grid grid-cols-2 gap-2">
                              {images.map((img, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => openLightbox(images, idx, n.title)}
                                  className="h-44 sm:h-56 rounded-2xl overflow-hidden border border-gray-200/80 cursor-pointer group relative bg-gray-100"
                                >
                                  <img
                                    src={img}
                                    alt={`Ảnh ${idx + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {images.length === 3 && (
                            <div className="grid grid-cols-3 gap-2">
                              <div
                                onClick={() => openLightbox(images, 0, n.title)}
                                className="col-span-2 h-52 sm:h-64 rounded-2xl overflow-hidden border border-gray-200/80 cursor-pointer group relative bg-gray-100"
                              >
                                <img
                                  src={images[0]}
                                  alt="Ảnh 1"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  loading="lazy"
                                />
                              </div>
                              <div className="col-span-1 grid grid-rows-2 gap-2 h-52 sm:h-64">
                                {images.slice(1, 3).map((img, idx) => (
                                  <div
                                    key={idx + 1}
                                    onClick={() => openLightbox(images, idx + 1, n.title)}
                                    className="h-full rounded-2xl overflow-hidden border border-gray-200/80 cursor-pointer group relative bg-gray-100"
                                  >
                                    <img
                                      src={img}
                                      alt={`Ảnh ${idx + 2}`}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      loading="lazy"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {images.length === 4 && (
                            <div className="grid grid-cols-2 gap-2">
                              {images.map((img, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => openLightbox(images, idx, n.title)}
                                  className="h-36 sm:h-48 rounded-2xl overflow-hidden border border-gray-200/80 cursor-pointer group relative bg-gray-100"
                                >
                                  <img
                                    src={img}
                                    alt={`Ảnh ${idx + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {images.length >= 5 && (
                            <div className="grid grid-cols-2 gap-2">
                              {images.slice(0, 3).map((img, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => openLightbox(images, idx, n.title)}
                                  className="h-36 sm:h-44 rounded-2xl overflow-hidden border border-gray-200/80 cursor-pointer group relative bg-gray-100"
                                >
                                  <img
                                    src={img}
                                    alt={`Ảnh ${idx + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                  />
                                </div>
                              ))}
                              {/* 4th slot with overlay +N photos */}
                              <div
                                onClick={() => openLightbox(images, 3, n.title)}
                                className="h-36 sm:h-44 rounded-2xl overflow-hidden border border-gray-200/80 cursor-pointer group relative bg-gray-100"
                              >
                                <img
                                  src={images[3]}
                                  alt="Ảnh 4"
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-slate-900/65 backdrop-blur-2xs flex flex-col items-center justify-center text-white transition-all group-hover:bg-slate-900/75">
                                  <span className="text-lg sm:text-2xl font-black">
                                    +{images.length - 3}
                                  </span>
                                  <span className="text-[11px] font-semibold text-slate-200 mt-0.5">
                                    Xem tất cả ảnh
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* B. Video đính kèm (YouTube hoặc MP4/WebM tải lên) */}
                      {videos.length > 0 && (
                        <div className="space-y-3 mb-3.5">
                          {videos.map((vid, vIdx) => {
                            const ytId = extractYouTubeId(vid.url);
                            return (
                              <div
                                key={vid.id || vIdx}
                                className="rounded-2xl overflow-hidden border border-gray-200/90 bg-black/95 shadow-2xs"
                              >
                                {ytId ? (
                                  <div className="relative w-full aspect-video">
                                    <iframe
                                      src={`https://www.youtube-nocookie.com/embed/${ytId}`}
                                      title={vid.title || 'Video YouTube'}
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                      className="w-full h-full border-0"
                                    />
                                  </div>
                                ) : (
                                  <div className="p-1">
                                    {vid.title && (
                                      <div className="px-3 py-1.5 text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                                        <VideoIcon className="w-3.5 h-3.5 text-[#EDB5C1]" />
                                        <span className="truncate">{vid.title}</span>
                                      </div>
                                    )}
                                    <video
                                      controls
                                      preload="metadata"
                                      playsInline
                                      className="w-full max-h-96 object-contain rounded-xl"
                                      src={vid.url}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* C. Thẻ liên kết đính kèm (Google Drive, Docs, Forms, Padlet, Website) */}
                      {links.length > 0 && (
                        <div className="space-y-2 mb-3.5">
                          {links.map((link, lIdx) => (
                            <a
                              key={link.id || lIdx}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-[#FCF4F6]/60 hover:bg-[#FCF4F6] border border-[#EDB5C1]/40 hover:border-[#EDB5C1] transition-all group shadow-2xs"
                            >
                              <div className="flex items-center gap-3 min-w-0 pr-2">
                                <div className="w-9 h-9 rounded-xl bg-white border border-[#EDB5C1]/50 flex items-center justify-center text-[#1E293B] shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                                  <ExternalLink className="w-4 h-4 text-[#1E293B]" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs sm:text-sm font-bold text-[#1E293B] group-hover:text-pink-700 truncate">
                                    {link.title}
                                  </h4>
                                  {link.description && (
                                    <p className="text-[11px] text-slate-500 truncate">
                                      {link.description}
                                    </p>
                                  )}
                                  <span className="text-[10px] text-slate-400 truncate block">
                                    {link.url}
                                  </span>
                                </div>
                              </div>
                              <span className="text-xs font-bold text-[#1E293B] shrink-0 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                <span className="hidden sm:inline">Mở liên kết</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Dòng 4: Ngày đăng và Tên giáo viên đăng thông báo */}
                      <footer className="pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Ngày đăng: {n.date}</span>
                        </span>
                        <span className="font-bold text-[#1E293B] flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-[#1E293B]" />
                          <span>{formatNoticeAuthor(n.author)}</span>
                        </span>
                      </footer>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          {/* CỘT PHẢI (~30%): TOP 5 HỌC TẬP & SƠ ĐỒ CHỖ NGỒI LỚP (CHUẨN THEO MẪU 8A3) */}
          <div className="lg:col-span-4 space-y-4">
            {/* THẺ 1: TOP 5 HỌC TẬP (Theo phong cách 8A3 sạch sẽ, tinh tế) */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-gray-200/80 shadow-2xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#FCF4F6] flex items-center justify-center text-[#1E293B] border border-[#EDB5C1]/50 shadow-2xs shrink-0">
                    <GraduationCap className="w-4 h-4 text-[#1E293B]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-black text-xs sm:text-sm text-[#1E293B] uppercase tracking-wider">
                        TOP 5 HỌC TẬP
                      </h3>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Bản nháp
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Tháng 11/2026 • ĐTB cao nhất
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTabChange('honor')}
                  className="text-xs font-black text-[#1E293B] hover:text-black flex items-center gap-0.5 cursor-pointer shrink-0"
                >
                  <span>Xem bảng vàng</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Body: Nếu chưa có dữ liệu, hiển thị nhẹ nhàng, lịch sự theo mẫu 8A3 */}
              {topStudents.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 italic">
                  Chưa có dữ liệu học tập để xếp hạng
                </div>
              ) : (
                <div className="space-y-1.5 pt-1">
                  {topStudents.map((s, idx) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/70 hover:bg-[#FCF4F6] border border-gray-100 text-xs transition-colors"
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
                        <span className="font-bold text-slate-800 truncate">
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

            {/* THẺ 2: SƠ ĐỒ CHỖ NGỒI LỚP (Bố cục đẹp mắt theo mẫu 8A3) */}
            <div className="bg-gradient-to-br from-[#FCF4F6] to-[#F8E2E7] text-[#1E293B] rounded-2xl sm:rounded-3xl p-5 shadow-2xs border border-[#EDB5C1] relative overflow-hidden group">
              <div className="absolute right-2 -bottom-2 opacity-10 group-hover:opacity-20 transition-opacity text-[#1E293B]">
                <Grid3X3 className="w-24 h-24" />
              </div>

              <div className="relative z-10 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white/70 backdrop-blur-xs flex items-center justify-center shadow-2xs">
                    <Grid3X3 className="w-4 h-4 text-[#1E293B]" />
                  </div>
                  <h3 className="font-black text-xs sm:text-sm uppercase tracking-wider text-[#1E293B]">
                    SƠ ĐỒ CHỖ NGỒI LỚP
                  </h3>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">
                  Đã xếp vị trí bàn học cho {Object.keys(seatingChart).length} / {state.students.length} học sinh trong lớp {state.config.className || '6A8'}.
                </p>

                {currentStudentDeskKey && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 text-[#1E293B] text-[11px] font-black border border-[#EDB5C1]">
                    <Star className="w-3 h-3 fill-[#1E293B]" />
                    <span>Bạn đã có vị trí ngồi cụ thể!</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleTabChange('seating')}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-[#1E293B] font-black text-xs rounded-xl shadow-2xs border border-gray-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Mở sơ đồ chỗ ngồi</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SƠ ĐỒ LỚP HỌC (GIỮ NGUYÊN HOÀN TOÀN CÁC CHỨC NĂNG XẾP CHỖ) */}
      {activeTab === 'seating' && (
        <div className="bg-white rounded-3xl p-5 sm:p-7 border border-[#EDB5C1]/50 shadow-xs space-y-6">
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
                  ? 'Giáo viên bấm vào bàn để xếp chỗ, hoặc sử dụng nút xếp tự động.'
                  : 'Sơ đồ lớp học chính thức do cô chủ nhiệm phân công.'}
              </p>
            </div>

            {isTeacher && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoAssign}
                  className="px-3.5 py-2 bg-[#FCF4F6] hover:bg-[#F8E2E7] text-[#1E293B] font-bold text-xs rounded-xl border border-[#EDB5C1]/60 transition-all cursor-pointer shadow-2xs"
                >
                  Xếp tự động
                </button>
                <button
                  type="button"
                  onClick={handleClearSeating}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs"
                >
                  Xóa sơ đồ
                </button>
              </div>
            )}
          </div>

          {!isTeacher && authStudentId && currentStudentDeskKey && (
            <div className="p-3 rounded-2xl bg-[#FCF4F6] border border-[#EDB5C1] flex items-center gap-2 text-xs text-[#1E293B] font-bold">
              <Star className="w-4 h-4 fill-[#C98292] text-[#C98292] shrink-0" />
              <span>Vị trí ngồi của bạn đang được làm nổi bật với viền hồng trên sơ đồ bên dưới.</span>
            </div>
          )}

          {/* Bảng lớp học phía trước */}
          <div className="max-w-md mx-auto text-center space-y-2">
            <div className="py-2.5 bg-[#1E293B] text-white rounded-2xl text-xs font-black tracking-wider uppercase shadow-md flex items-center justify-center gap-2">
              <span>BẢNG LỚP HỌC (PHÍA TRƯỚC)</span>
            </div>
            <div className="w-40 mx-auto py-1.5 bg-[#FCF4F6] border border-[#EDB5C1] text-[#1E293B] rounded-xl text-xs font-bold shadow-2xs">
              Bàn Giáo Viên
            </div>
          </div>

          {/* Lưới 5 hàng x 4 bàn */}
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
                    const student = state.students.find((s) => s.id === assignedStudentId);
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
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest absolute top-2 left-2.5">
                          Bàn {rowIndex + 1}.{colIndex + 1}
                        </span>

                        {student ? (
                          <div className="pt-3">
                            <div className="w-8 h-8 rounded-full bg-[#EDB5C1] text-[#1E293B] font-black text-xs flex items-center justify-center mx-auto mb-1.5 shadow-2xs">
                              {student.name.charAt(student.name.lastIndexOf(' ') + 1) || student.name.charAt(0)}
                            </div>
                            <div className="font-bold text-xs text-gray-900 truncate max-w-[140px]">
                              {student.name}
                            </div>
                            <div className="text-[10px] text-gray-400 font-medium">
                              {student.gender} • {student.dob ? student.dob.substring(0, 4) : ''}
                            </div>
                          </div>
                        ) : (
                          <div className="py-4 text-gray-400 text-xs font-medium">
                            {isTeacher ? '+ Xếp học sinh' : 'Bàn trống'}
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

      {/* TAB 3: VINH DANH & THI ĐUA (GIỮ NGUYÊN DANH SÁCH BẢNG VÀNG) */}
      {activeTab === 'honor' && (
        <div className="bg-white rounded-3xl p-5 sm:p-7 border border-[#EDB5C1]/50 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span>Bảng Vàng Vinh Danh & Thi Đua Lớp {state.config.className || '6A8'}</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Tuyên dương các tấm gương học tập tốt và rèn luyện nề nếp xuất sắc.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Cột 1: Top 5 Học Tập */}
            <div className="p-4 rounded-2xl bg-gray-50/70 border border-gray-200/80 space-y-3">
              <h3 className="font-black text-sm text-[#1E293B] flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#1E293B]" />
                <span>TOP 5 HỌC SINH ĐIỂM TRUNG BÌNH CAO NHẤT</span>
              </h3>
              {topStudents.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 italic">
                  Chưa có dữ liệu học tập để xếp hạng
                </div>
              ) : (
                <div className="space-y-2">
                  {topStudents.map((s, idx) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-xl bg-white border border-gray-200/70 flex items-center justify-between text-xs shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs text-white ${
                            idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-700' : 'bg-gray-400'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-900">{s.name}</span>
                      </div>
                      <span className="font-black text-[#1E293B]">{s.avgGrade.toFixed(2)} đ</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cột 2: Danh hiệu rèn luyện & thi đua */}
            <div className="p-4 rounded-2xl bg-gray-50/70 border border-gray-200/80 space-y-3">
              <h3 className="font-black text-sm text-[#1E293B] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>TIÊU CHUẨN KHEN THƯỞNG RÈN LUYỆN</span>
              </h3>
              <div className="p-3 rounded-xl bg-white border border-gray-200/70 text-xs space-y-2 text-slate-700 leading-relaxed shadow-2xs">
                <p>
                  🏆 <strong>Ngôi sao Kỷ luật:</strong> Học sinh giữ vững phong độ không vi phạm nề nếp trong tháng.
                </p>
                <p>
                  🌟 <strong>Gia đình xuất sắc:</strong> Tổ có tổng điểm thi đua cao nhất và nề nếp đồng đều nhất.
                </p>
                <p>
                  🎯 <strong>Tiến bộ vượt bậc:</strong> Học sinh có sự bứt phá nổi bật về điểm số và ý thức học tập.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ĐĂNG THÔNG TIN MỚI / CHỈNH SỬA THÔNG BÁO (HỖ TRỢ NHIỀU ẢNH, VIDEO, LINK) */}
      {isNoticeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-[#FCF4F6] to-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#EDB5C1] text-[#1E293B] flex items-center justify-center font-bold shadow-2xs">
                  <Megaphone className="w-5 h-5 text-[#1E293B]" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-[#1E293B]">
                    {editingNoticeId ? 'Chỉnh sửa thông tin – Lớp 6A8' : 'Đăng thông tin mới – Lớp 6A8'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Bổ sung hình ảnh, video YouTube và tài liệu liên kết cho học sinh
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNoticeModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Scrollable */}
            <form onSubmit={handleSaveNotice} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              {/* 1. Tiêu đề thông báo * */}
              <div>
                <label className="block text-xs font-black text-[#1E293B] mb-1.5 uppercase tracking-wider">
                  Tiêu đề thông báo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Kế hoạch kiểm tra giữa kỳ, Khen thưởng thi đua tuần..."
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-gray-50 focus:bg-white border border-gray-200 focus:border-[#EDB5C1] rounded-xl text-[#1E293B] focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]/30 transition-all font-semibold"
                />
              </div>

              {/* 2. Nội dung chi tiết * */}
              <div>
                <label className="block text-xs font-black text-[#1E293B] mb-1.5 uppercase tracking-wider">
                  Nội dung chi tiết <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Nhập nội dung dặn dò, hướng dẫn học tập đến học sinh và phụ huynh..."
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-gray-50 focus:bg-white border border-gray-200 focus:border-[#EDB5C1] rounded-xl text-[#1E293B] focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]/30 transition-all leading-relaxed"
                />
              </div>

              {/* 3 & 4. Loại thông báo & Mức độ ưu tiên */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Loại thông báo
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl text-[#1E293B] font-semibold focus:outline-hidden focus:border-[#EDB5C1]"
                  >
                    <option value="Thông báo">Thông báo</option>
                    <option value="Khen thưởng">Khen thưởng</option>
                    <option value="Kế hoạch">Kế hoạch</option>
                    <option value="Nhắc nhở">Nhắc nhở</option>
                    <option value="Khẩn">Khẩn / Quan trọng</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mức độ ưu tiên
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl text-[#1E293B] font-semibold focus:outline-hidden focus:border-[#EDB5C1]"
                  >
                    <option value="normal">Thông thường</option>
                    <option value="info">Nhắc nhở nhẹ</option>
                    <option value="high">Quan trọng / Khẩn cấp</option>
                  </select>
                </div>
              </div>

              {/* 5. KHU VỰC ĐÍNH KÈM ĐA PHƯƠNG TIỆN (3 TAB: HÌNH ẢNH, VIDEO, LIÊN KẾT) */}
              <div className="pt-2 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#1E293B] uppercase tracking-wider">
                    Đính kèm Đa phương tiện
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {attachedImages.length} ảnh • {attachedVideos.length} video • {attachedLinks.length} liên kết
                  </span>
                </div>

                {/* 3 nút chuyển Tab đa phương tiện */}
                <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setActiveMediaTab('images')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeMediaTab === 'images'
                        ? 'bg-white text-[#1E293B] shadow-2xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-[#1E293B]" />
                    <span>Hình ảnh ({attachedImages.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveMediaTab('videos')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeMediaTab === 'videos'
                        ? 'bg-white text-[#1E293B] shadow-2xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <VideoIcon className="w-3.5 h-3.5 text-[#1E293B]" />
                    <span>Video ({attachedVideos.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveMediaTab('links')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeMediaTab === 'links'
                        ? 'bg-white text-[#1E293B] shadow-2xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <LinkIcon className="w-3.5 h-3.5 text-[#1E293B]" />
                    <span>Liên kết ({attachedLinks.length})</span>
                  </button>
                </div>

                {/* TAB CON 1: HÌNH ẢNH */}
                {activeMediaTab === 'images' && (
                  <div className="space-y-3 p-3.5 bg-gray-50/70 rounded-2xl border border-gray-200/80">
                    <input
                      type="file"
                      ref={fileInputRef}
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => handleImageFiles(e.target.files)}
                    />

                    {/* Vùng kéo thả hoặc bấm tải ảnh */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleImageFiles(e.dataTransfer.files);
                      }}
                      className="p-5 border-2 border-dashed border-[#EDB5C1] hover:border-[#C98292] rounded-2xl text-center cursor-pointer bg-white hover:bg-[#FCF4F6]/50 transition-colors group"
                    >
                      <Upload className="w-6 h-6 text-[#1E293B] mx-auto mb-1.5 group-hover:-translate-y-0.5 transition-transform" />
                      <p className="text-xs font-bold text-[#1E293B]">
                        Bấm để chọn nhiều ảnh hoặc kéo thả ảnh vào đây
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Hỗ trợ định dạng JPG, PNG, WEBP. Ảnh được tự động tối ưu hóa tải nhanh.
                      </p>
                    </div>

                    {isCompressingImages && (
                      <div className="text-center text-xs text-[#1E293B] font-semibold py-1 flex items-center justify-center gap-1.5">
                        <span className="w-3.5 h-3.5 border-2 border-[#1E293B] border-t-transparent rounded-full animate-spin" />
                        <span>Đang tối ưu dung lượng ảnh...</span>
                      </div>
                    )}

                    {/* Danh sách ảnh xem trước & thao tác xóa */}
                    {attachedImages.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-500">
                          Ảnh đã đính kèm ({attachedImages.length}):
                        </span>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                          {attachedImages.map((img, idx) => (
                            <div
                              key={idx}
                              className="relative h-20 rounded-xl overflow-hidden border border-gray-200 group bg-gray-100"
                            >
                              <img
                                src={img}
                                alt={`Ảnh ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setAttachedImages((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="absolute top-1 right-1 p-1 rounded-md bg-rose-600 text-white shadow-xs hover:bg-rose-700 transition-colors cursor-pointer"
                                title="Xóa ảnh này"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/60 text-white">
                                #{idx + 1}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB CON 2: VIDEO */}
                {activeMediaTab === 'videos' && (
                  <div className="space-y-3 p-3.5 bg-gray-50/70 rounded-2xl border border-gray-200/80">
                    <input
                      type="file"
                      ref={videoFileInputRef}
                      accept="video/mp4,video/webm"
                      className="hidden"
                      onChange={(e) => handleVideoFile(e.target.files)}
                    />

                    {/* Nhập link YouTube */}
                    <div className="space-y-2 bg-white p-3 rounded-xl border border-gray-200/80">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E293B]">
                        <VideoIcon className="w-3.5 h-3.5" />
                        <span>Đính kèm video từ YouTube:</span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={videoUrlInput}
                          onChange={(e) => setVideoUrlInput(e.target.value)}
                          placeholder="Dán link YouTube (VD: https://www.youtube.com/watch?v=...)"
                          className="flex-1 px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl text-[#1E293B] focus:outline-hidden focus:border-[#EDB5C1]"
                        />
                        <button
                          type="button"
                          onClick={handleAddVideoUrl}
                          className="px-3.5 py-1.5 bg-[#EDB5C1] hover:bg-[#E4A7B4] text-[#1E293B] text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
                        >
                          + Thêm video
                        </button>
                      </div>
                    </div>

                    {/* Hoặc tải video trực tiếp từ máy */}
                    <div className="text-center py-2">
                      <span className="text-[11px] text-slate-400">hoặc</span>
                      <div className="mt-1">
                        <button
                          type="button"
                          onClick={() => videoFileInputRef.current?.click()}
                          className="px-3.5 py-1.5 bg-white hover:bg-gray-100 text-slate-700 text-xs font-bold rounded-xl border border-gray-200 transition-all cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5 text-[#1E293B]" />
                          <span>Tải tệp video từ máy tính / điện thoại (MP4, WebM)</span>
                        </button>
                      </div>
                    </div>

                    {/* Danh sách video đã thêm */}
                    {attachedVideos.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-slate-500">
                          Video đã đính kèm ({attachedVideos.length}):
                        </span>
                        {attachedVideos.map((v, idx) => (
                          <div
                            key={v.id || idx}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-gray-200 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <Play className="w-4 h-4 text-rose-600 shrink-0" />
                              <div className="min-w-0">
                                <p className="font-bold text-[#1E293B] truncate">
                                  {v.title || `Video ${idx + 1}`}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">{v.url}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setAttachedVideos((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Xóa video này"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB CON 3: LIÊN KẾT */}
                {activeMediaTab === 'links' && (
                  <div className="space-y-3 p-3.5 bg-gray-50/70 rounded-2xl border border-gray-200/80">
                    <div className="bg-white p-3 rounded-xl border border-gray-200/80 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E293B]">
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>Thêm đường dẫn tài liệu / website học tập:</span>
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={linkTitleInput}
                          onChange={(e) => setLinkTitleInput(e.target.value)}
                          placeholder="Tên hiển thị (VD: Google Drive bài tập tuần 10, Google Forms đăng ký...)"
                          className="w-full px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl text-[#1E293B] focus:outline-hidden focus:border-[#EDB5C1]"
                        />
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="url"
                            value={linkUrlInput}
                            onChange={(e) => setLinkUrlInput(e.target.value)}
                            placeholder="Đường link https://..."
                            className="flex-1 px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl text-[#1E293B] focus:outline-hidden focus:border-[#EDB5C1]"
                          />
                          <button
                            type="button"
                            onClick={handleAddLink}
                            className="px-3.5 py-1.5 bg-[#EDB5C1] hover:bg-[#E4A7B4] text-[#1E293B] text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
                          >
                            + Thêm liên kết
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Danh sách link đã thêm */}
                    {attachedLinks.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-slate-500">
                          Liên kết đã đính kèm ({attachedLinks.length}):
                        </span>
                        {attachedLinks.map((l, idx) => (
                          <div
                            key={l.id || idx}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-gray-200 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <ExternalLink className="w-4 h-4 text-blue-600 shrink-0" />
                              <div className="min-w-0">
                                <p className="font-bold text-[#1E293B] truncate">{l.title}</p>
                                <p className="text-[10px] text-slate-400 truncate">{l.url}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setAttachedLinks((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Xóa liên kết này"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 6. Người ký / đăng */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Người ký / Đăng thông báo
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl text-[#1E293B] font-semibold focus:outline-hidden focus:border-[#EDB5C1]"
                />
              </div>

              {/* 7. Ghim thông báo */}
              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-gray-50 hover:bg-[#FCF4F6] border border-gray-200/80 cursor-pointer transition-colors select-none">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="w-4 h-4 rounded text-[#1E293B] accent-[#EDB5C1] cursor-pointer"
                />
                <span className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                  <Pin className="w-3.5 h-3.5 text-rose-600" />
                  <span>Ghim thông báo này lên đầu bảng tin để học sinh dễ thấy</span>
                </span>
              </label>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsNoticeModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#EDB5C1] hover:bg-[#E4A7B4] text-[#1E293B] font-black text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
                  >
                    {editingNoticeId ? 'Lưu thay đổi' : 'Đăng thông báo'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: LIGHTBOX (TRÌNH XEM ẢNH TOÀN MÀN HÌNH CHUYÊN NGHIỆP) */}
      {lightbox.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-fadeIn select-none">
          {/* Top bar with count & close */}
          <div className="absolute top-4 inset-x-4 flex items-center justify-between text-white z-20">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-white/20 backdrop-blur-xs px-3 py-1 rounded-full">
                Ảnh {lightbox.index + 1} / {lightbox.images.length}
              </span>
              {lightbox.title && (
                <span className="text-xs font-medium text-slate-300 truncate max-w-xs sm:max-w-md hidden sm:inline">
                  {lightbox.title}
                </span>
              )}
            </div>
            <button
              onClick={closeLightbox}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all cursor-pointer"
              title="Đóng xem ảnh (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Prev button */}
          {lightbox.images.length > 1 && (
            <button
              onClick={prevLightboxImage}
              className="absolute left-4 p-3 rounded-full bg-white/20 hover:bg-white/40 text-white transition-all cursor-pointer z-20"
              title="Ảnh trước (Mũi tên trái)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Centered Image */}
          <div className="max-w-[90vw] max-h-[85vh] flex items-center justify-center p-4">
            <img
              src={lightbox.images[lightbox.index]}
              alt={`Xem ảnh ${lightbox.index + 1}`}
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl animate-fadeIn"
            />
          </div>

          {/* Next button */}
          {lightbox.images.length > 1 && (
            <button
              onClick={nextLightboxImage}
              className="absolute right-4 p-3 rounded-full bg-white/20 hover:bg-white/40 text-white transition-all cursor-pointer z-20"
              title="Ảnh tiếp theo (Mũi tên phải)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Bottom thumbnail strip if > 1 image */}
          {lightbox.images.length > 1 && (
            <div className="absolute bottom-4 inset-x-4 flex items-center justify-center gap-2 overflow-x-auto py-1 z-20">
              {lightbox.images.map((thumb, tIdx) => (
                <button
                  key={tIdx}
                  onClick={() => setLightbox((prev) => ({ ...prev, index: tIdx }))}
                  className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                    tIdx === lightbox.index
                      ? 'border-[#EDB5C1] scale-110 shadow-lg'
                      : 'border-white/30 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={thumb} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 3: XẾP CHỖ NGỒI HỌC SINH (KHI GIÁO VIÊN BẤM VÀO BÀN) */}
      {assigningDeskKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-black text-sm text-[#1E293B]">
                Xếp học sinh vào vị trí bàn
              </h3>
              <button
                onClick={() => setAssigningDeskKey(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              <button
                onClick={() => handleAssignStudent(assigningDeskKey, '')}
                className="w-full p-2.5 rounded-xl text-left text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
              >
                Trống bàn (Hủy xếp học sinh)
              </button>

              {state.students.map((s) => {
                const currentSeat = Object.keys(seatingChart).find(
                  (k) => seatingChart[k] === s.id
                );
                return (
                  <button
                    key={s.id}
                    onClick={() => handleAssignStudent(assigningDeskKey, s.id)}
                    className="w-full p-2.5 rounded-xl text-left text-xs font-semibold text-gray-800 hover:bg-[#FCF4F6] hover:text-[#1E293B] border border-gray-100 flex items-center justify-between transition-colors"
                  >
                    <span>{s.name}</span>
                    {currentSeat && (
                      <span className="text-[10px] text-gray-400">
                        (Đang ngồi: {currentSeat.replace('desk_', 'Bàn ')})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

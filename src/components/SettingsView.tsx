import React, { useState } from 'react';
import { AppState, DisciplineRule, EmulationConfig } from '../types';
import {
  Settings,
  Save,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  School,
  Lock,
  Scale,
  SlidersHorizontal,
  Plus,
  Edit2,
  Search,
  Award,
  ShieldAlert,
  Sparkles,
  X,
  Check,
} from 'lucide-react';
import { SyncStatus } from '../services/supabaseService';
import { DEFAULT_DISCIPLINE_RULES } from '../defaultData';
import { EmulationScaleSettings } from './EmulationScaleSettings';

interface SettingsViewProps {
  state: AppState;
  onUpdateConfig: (newConfig: Partial<AppState['config']>) => void;
  onUpdateDisciplineRules: (rules: DisciplineRule[]) => void;
  onUpdateEmulationConfig?: (newConfig: EmulationConfig) => Promise<{ success: boolean; error?: string }> | void;
  onResetData: () => void;
  onClearAllData: () => void;
  onImportBackup: (backupState: AppState) => void;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
  syncStatus: SyncStatus;
  onOpenSupabaseModal: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  state,
  onUpdateConfig,
  onUpdateDisciplineRules,
  onUpdateEmulationConfig,
  onResetData,
  onClearAllData,
  onImportBackup,
  onShowToast,
  syncStatus,
  onOpenSupabaseModal,
}) => {
  // Navigation tabs matching the user mockup
  const [activeTab, setActiveTab] = useState<'rules' | 'general' | 'cloud' | 'backup'>('rules');

  // Sub-tabs for "Quy tắc thi đua": "Quy tắc cộng/trừ điểm" & "Thang điểm & Xếp loại"
  const [rulesSubTab, setRulesSubTab] = useState<'rules_list' | 'scale_rating'>('rules_list');

  // Form config for "Cài đặt chung"
  const [formConfig, setFormConfig] = useState(state.config);

  // Discipline rules state
  const currentRules = (state.disciplineRules && state.disciplineRules.length > 0)
    ? state.disciplineRules
    : DEFAULT_DISCIPLINE_RULES;

  // Filter & Search state for rules
  const [ruleSearch, setRuleSearch] = useState('');
  const [ruleFilterType, setRuleFilterType] = useState<'all' | 'plus' | 'minus'>('all');

  // Modal Add / Edit Rule state
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleFormName, setRuleFormName] = useState('');
  const [ruleFormType, setRuleFormType] = useState<'plus' | 'minus'>('minus');
  const [ruleFormPoints, setRuleFormPoints] = useState<number>(2);
  const [ruleFormDesc, setRuleFormDesc] = useState('');

  // Save General Config
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig(formConfig);
    onShowToast('Đã lưu cài đặt chung thành công!');
  };

  // Open modal to add rule
  const handleOpenAddRule = () => {
    setEditingRuleId(null);
    setRuleFormName('');
    setRuleFormType('minus');
    setRuleFormPoints(2);
    setRuleFormDesc('');
    setIsRuleModalOpen(true);
  };

  // Open modal to edit rule
  const handleOpenEditRule = (rule: DisciplineRule) => {
    setEditingRuleId(rule.id);
    setRuleFormName(rule.name);
    setRuleFormType(rule.type);
    setRuleFormPoints(Math.abs(rule.points));
    setRuleFormDesc(rule.description || '');
    setIsRuleModalOpen(true);
  };

  // Save rule from modal
  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrimmed = ruleFormName.trim();
    if (!nameTrimmed) {
      onShowToast('Vui lòng nhập tên quy tắc', 'error');
      return;
    }

    const calculatedPoints = ruleFormType === 'plus' ? Math.abs(ruleFormPoints) : -Math.abs(ruleFormPoints);

    if (editingRuleId) {
      // Update existing
      const updated = currentRules.map((r) =>
        r.id === editingRuleId
          ? {
              ...r,
              name: nameTrimmed,
              type: ruleFormType,
              points: calculatedPoints,
              description: ruleFormDesc.trim() || undefined,
            }
          : r
      );
      onUpdateDisciplineRules(updated);
      onShowToast('Đã cập nhật quy tắc thi đua!');
    } else {
      // Add new
      const newRule: DisciplineRule = {
        id: 'rule_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
        name: nameTrimmed,
        type: ruleFormType,
        points: calculatedPoints,
        description: ruleFormDesc.trim() || undefined,
      };
      onUpdateDisciplineRules([...currentRules, newRule]);
      onShowToast('Đã thêm quy tắc thi đua mới!');
    }

    setIsRuleModalOpen(false);
  };

  // Delete rule
  const handleDeleteRule = (id: string, name: string) => {
    const updated = currentRules.filter((r) => r.id !== id);
    onUpdateDisciplineRules(updated);
    onShowToast(`Đã xóa quy tắc "${name}"`);
  };

  // Reset rules to defaults
  const handleResetDefaultRules = () => {
    onUpdateDisciplineRules(DEFAULT_DISCIPLINE_RULES);
    onShowToast('Đã khôi phục danh sách quy tắc thi đua mặc định');
  };

  // Export JSON Backup
  const handleExportBackup = () => {
    const jsonString = JSON.stringify(state, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Sao_luu_so_chu_nhiem_${state.config.className}_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast('Đã tải xuống file sao lưu hệ thống (JSON)');
  };

  // Import JSON Backup
  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && parsed.config && Array.isArray(parsed.students)) {
            onImportBackup(parsed);
            onShowToast('Khôi phục dữ liệu từ bản sao lưu thành công!');
          } else {
            onShowToast('File sao lưu không đúng định dạng', 'error');
          }
        } catch {
          onShowToast('Không thể đọc file sao lưu JSON', 'error');
        }
      };
      reader.readAsText(file);
    }
  };

  // Filtered rules
  const filteredRules = currentRules.filter((rule) => {
    const matchesSearch =
      rule.name.toLowerCase().includes(ruleSearch.toLowerCase()) ||
      (rule.description && rule.description.toLowerCase().includes(ruleSearch.toLowerCase()));
    const matchesType =
      ruleFilterType === 'all' ? true : rule.type === ruleFilterType;
    return matchesSearch && matchesType;
  });

  const plusRulesCount = currentRules.filter((r) => r.type === 'plus').length;
  const minusRulesCount = currentRules.filter((r) => r.type === 'minus').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#E5B2BD] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#EDB5C1] flex items-center justify-center text-[#1E293B] shadow-sm shadow-[#EDB5C1]/25">
              <Settings className="w-5 h-5" />
            </div>
            <span>Cài Đặt Hệ Thống</span>
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 font-medium">
            Quản lý quy tắc thi đua nề nếp, thông tin chung lớp học, kết nối đám mây và dữ liệu sao lưu
          </p>
        </div>

        {activeTab === 'rules' && rulesSubTab === 'rules_list' && (
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleResetDefaultRules}
              className="px-3.5 py-2 rounded-xl border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="Khôi phục lại danh sách 16 quy tắc mặc định của nhà trường"
            >
              <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
              <span>Khôi phục mặc định</span>
            </button>
            <button
              onClick={handleOpenAddRule}
              className="px-4 py-2 rounded-xl bg-[#EDB5C1] hover:bg-[#E4A7B4] text-[#1E293B] text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#EDB5C1]/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm quy tắc mới</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Layout: Left Sub-navigation + Right Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Sub-Navigation Sidebar */}
        <div className="lg:col-span-1 bg-white rounded-3xl p-3 sm:p-4 border border-[#E5B2BD] shadow-xs space-y-1.5">
          <div className="px-3 py-2 text-[11px] font-black uppercase tracking-wider text-gray-400">
            Danh Mục Cài Đặt
          </div>

          {/* 1. Cài đặt chung (Sliders) */}
          <button
            onClick={() => setActiveTab('general')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all cursor-pointer font-bold text-xs sm:text-sm ${
              activeTab === 'general'
                ? 'bg-[#EDB5C1] text-[#1E293B] font-black shadow-md shadow-[#EDB5C1]/25 border border-[#E5B2BD]'
                : 'text-gray-700 hover:bg-[#FCF4F6] hover:text-[#1E293B]'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                activeTab === 'general' ? 'bg-white/40 text-[#1E293B]' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="font-bold">Cài đặt chung</div>
              <div
                className={`text-[11px] font-medium truncate ${
                  activeTab === 'general' ? 'text-slate-800' : 'text-gray-400'
                }`}
              >
                Thông tin trường, lớp, GVCN
              </div>
            </div>
          </button>

          {/* 2. Quy tắc thi đua (Scale) - ACTIVE ITEM */}
          <button
            onClick={() => setActiveTab('rules')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all cursor-pointer font-bold text-xs sm:text-sm ${
              activeTab === 'rules'
                ? 'bg-[#EDB5C1] text-[#1E293B] font-black shadow-md shadow-[#EDB5C1]/25 border border-[#E5B2BD]'
                : 'text-gray-700 hover:bg-[#FCF4F6] hover:text-[#1E293B]'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                activeTab === 'rules' ? 'bg-white/40 text-[#1E293B]' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Scale className="w-4 h-4" />
            </div>
            <div className="truncate flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold">Quy tắc thi đua</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                    activeTab === 'rules'
                      ? 'bg-white/50 text-[#1E293B]'
                      : 'bg-[#FCF4F6] text-[#1E293B] border border-[#EDB5C1]'
                  }`}
                >
                  {currentRules.length}
                </span>
              </div>
              <div
                className={`text-[11px] font-medium truncate ${
                  activeTab === 'rules' ? 'text-slate-800' : 'text-gray-400'
                }`}
              >
                Khen thưởng & Vi phạm nề nếp
              </div>
            </div>
          </button>

          {/* 3. Đồng bộ đám mây (Cloud) */}
          <button
            onClick={() => setActiveTab('cloud')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all cursor-pointer font-bold text-xs sm:text-sm ${
              activeTab === 'cloud'
                ? 'bg-[#EDB5C1] text-[#1E293B] font-black shadow-md shadow-[#EDB5C1]/25 border border-[#E5B2BD]'
                : 'text-gray-700 hover:bg-[#FCF4F6] hover:text-[#1E293B]'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                activeTab === 'cloud' ? 'bg-white/40 text-[#1E293B]' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Cloud className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="font-bold">Đồng bộ đám mây</div>
              <div
                className={`text-[11px] font-medium truncate ${
                  activeTab === 'cloud' ? 'text-slate-800' : 'text-gray-400'
                }`}
              >
                Supabase Cloud & tự động lưu
              </div>
            </div>
          </button>

          {/* 4. Sao lưu & Dữ liệu (Save) */}
          <button
            onClick={() => setActiveTab('backup')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all cursor-pointer font-bold text-xs sm:text-sm ${
              activeTab === 'backup'
                ? 'bg-[#EDB5C1] text-[#1E293B] font-black shadow-md shadow-[#EDB5C1]/25 border border-[#E5B2BD]'
                : 'text-gray-700 hover:bg-[#FCF4F6] hover:text-[#1E293B]'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                activeTab === 'backup' ? 'bg-white/40 text-[#1E293B]' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Save className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="font-bold">Sao lưu & Dữ liệu</div>
              <div
                className={`text-[11px] font-medium truncate ${
                  activeTab === 'backup' ? 'text-slate-800' : 'text-gray-400'
                }`}
              >
                Xuất file JSON, nhập & xóa
              </div>
            </div>
          </button>
        </div>

        {/* Right Content Area */}
        <div className="lg:col-span-3">
          {/* TAB 1: QUY TẮC THI ĐUA (THE USER'S PRIMARY SCREEN) */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              {/* 2 Sub-tabs Bar: “Quy tắc cộng/trừ điểm” & “Thang điểm & Xếp loại” */}
              <div className="bg-white rounded-2xl p-1.5 border border-[#E5B2BD] shadow-2xs flex items-center gap-1.5 max-w-lg">
                <button
                  type="button"
                  onClick={() => setRulesSubTab('rules_list')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                    rulesSubTab === 'rules_list'
                      ? 'bg-[#EDB5C1] text-[#1E293B] shadow-sm shadow-[#EDB5C1]/20 border border-[#E5B2BD]'
                      : 'text-gray-600 hover:text-[#1E293B] hover:bg-[#FCF4F6]'
                  }`}
                >
                  <Scale className="w-4 h-4" />
                  <span>Quy tắc cộng/trừ điểm</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                      rulesSubTab === 'rules_list'
                        ? 'bg-white/40 text-[#1E293B]'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {currentRules.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRulesSubTab('scale_rating')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                    rulesSubTab === 'scale_rating'
                      ? 'bg-[#EDB5C1] text-[#1E293B] shadow-sm shadow-[#EDB5C1]/20 border border-[#E5B2BD]'
                      : 'text-gray-600 hover:text-[#1E293B] hover:bg-[#FCF4F6]'
                  }`}
                >
                  <Award className="w-4 h-4" />
                  <span>Thang điểm & Xếp loại</span>
                </button>
              </div>

              {rulesSubTab === 'rules_list' ? (
                <>
                  {/* Filter, Search & Stats Header */}
                  <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#E5B2BD] shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5B2BD]/50">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#FCF4F6] border border-[#EDB5C1] flex items-center justify-center text-[#1E293B] shrink-0">
                          <Scale className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base sm:text-lg font-black text-gray-900">
                            Danh Sách Quy Tắc Thi Đua & Nề Nếp
                          </h3>
                          <p className="text-xs text-gray-500">
                            Áp dụng trực tiếp vào danh sách lựa chọn khi giáo viên ghi nhận nề nếp cho học sinh
                          </p>
                        </div>
                      </div>

                  {/* Summary badges */}
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{plusRulesCount} Khen thưởng</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>{minusRulesCount} Vi phạm</span>
                    </span>
                  </div>
                </div>

                {/* Search & Filter Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  {/* Search input */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={ruleSearch}
                      onChange={(e) => setRuleSearch(e.target.value)}
                      placeholder="Tìm kiếm quy tắc thi đua theo tên..."
                      className="w-full pl-9 pr-4 py-2.5 bg-gray-50/70 focus:bg-white border border-gray-200 focus:border-[#EDB5C1] rounded-xl text-xs sm:text-sm font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]/40 transition-all"
                    />
                    {ruleSearch && (
                      <button
                        onClick={() => setRuleSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filter tabs */}
                  <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 rounded-xl border border-gray-200/80 shrink-0">
                    <button
                      onClick={() => setRuleFilterType('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        ruleFilterType === 'all'
                          ? 'bg-white text-gray-900 shadow-2xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Tất cả ({currentRules.length})
                    </button>
                    <button
                      onClick={() => setRuleFilterType('plus')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        ruleFilterType === 'plus'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-gray-600 hover:text-emerald-700'
                      }`}
                    >
                      Khen thưởng ({plusRulesCount})
                    </button>
                    <button
                      onClick={() => setRuleFilterType('minus')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        ruleFilterType === 'minus'
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'text-gray-600 hover:text-rose-700'
                      }`}
                    >
                      Vi phạm ({minusRulesCount})
                    </button>
                  </div>
                </div>
              </div>

              {/* Rules List / Table */}
              <div className="bg-white rounded-3xl border border-[#E5B2BD] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#FCF4F6] text-[11px] font-black uppercase tracking-wider text-[#1E293B] border-b border-[#E5B2BD]">
                        <th className="py-3 px-4 w-12 text-center">STT</th>
                        <th className="py-3 px-4">Tên quy tắc / Nội dung</th>
                        <th className="py-3 px-4 w-36 text-center">Phân loại</th>
                        <th className="py-3 px-4 w-28 text-center">Mức điểm</th>
                        <th className="py-3 px-4 hidden md:table-cell">Mô tả / Diễn giải</th>
                        <th className="py-3 px-4 w-28 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
                      {filteredRules.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-gray-400">
                            <Scale className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                            <p className="font-medium text-xs">Không tìm thấy quy tắc nào phù hợp</p>
                            {ruleSearch && (
                              <button
                                onClick={() => setRuleSearch('')}
                                className="mt-2 text-xs text-[#1E293B] font-bold hover:underline"
                              >
                                Xóa bộ lọc tìm kiếm
                              </button>
                            )}
                          </td>
                        </tr>
                      ) : (
                        filteredRules.map((rule, idx) => {
                          const isPlus = rule.type === 'plus';
                          return (
                            <tr
                              key={rule.id}
                              className="hover:bg-[#FCF4F6]/50 transition-colors group"
                            >
                              {/* STT */}
                              <td className="py-3.5 px-4 text-center font-bold text-gray-400 text-xs">
                                {idx + 1}
                              </td>

                              {/* Tên quy tắc */}
                              <td className="py-3.5 px-4 font-bold text-gray-900">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${isPlus ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                  <span>{rule.name}</span>
                                </div>
                              </td>

                              {/* Phân loại badge */}
                              <td className="py-3.5 px-4 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border ${
                                    isPlus
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
                                >
                                  {isPlus ? '+ Khen thưởng' : '- Vi phạm'}
                                </span>
                              </td>

                              {/* Mức điểm */}
                              <td className="py-3.5 px-4 text-center font-black">
                                <span
                                  className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black ${
                                    isPlus
                                      ? 'bg-emerald-100/70 text-emerald-800'
                                      : 'bg-rose-100/70 text-rose-800'
                                  }`}
                                >
                                  {isPlus ? `+${rule.points} đ` : `${rule.points} đ`}
                                </span>
                              </td>

                              {/* Mô tả */}
                              <td className="py-3.5 px-4 text-gray-500 text-xs hidden md:table-cell">
                                {rule.description || (
                                  <span className="text-gray-300 italic">Không có mô tả</span>
                                )}
                              </td>

                              {/* Thao tác */}
                              <td className="py-3.5 px-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleOpenEditRule(rule)}
                                    className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                    title="Chỉnh sửa quy tắc"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRule(rule.id, rule.name)}
                                    className="p-1.5 rounded-lg text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Xóa quy tắc"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer notes */}
                <div className="p-4 bg-gray-50/60 border-t border-gray-100 text-xs text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <span>
                    Hiển thị <strong>{filteredRules.length}</strong> trên tổng số <strong>{currentRules.length}</strong> quy tắc
                  </span>
                  <span className="text-gray-400 italic">
                    Thay đổi được lưu tự động lên bộ nhớ và Supabase Cloud
                  </span>
                </div>
              </div>
            </>
          ) : (
            <EmulationScaleSettings
              state={state}
              onUpdateEmulationConfig={onUpdateEmulationConfig || (() => {})}
              onShowToast={onShowToast}
            />
          )}
        </div>
      )}

          {/* TAB 2: CÀI ĐẶT CHUNG (GENERAL CONFIG) */}
          {activeTab === 'general' && (
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E5B2BD] shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E5B2BD]/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#FCF4F6] border border-[#EDB5C1] flex items-center justify-center text-[#1E293B]">
                    <School className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-gray-900">
                      Thông Tin Nhà Trường, Lớp Học & Giáo Viên Chủ Nhiệm
                    </h3>
                    <p className="text-xs text-gray-500">
                      Chỉ có Giáo viên chủ nhiệm mới có quyền thay đổi thông tin này. Thay đổi sẽ cập nhật đồng bộ toàn hệ thống.
                    </p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-black bg-[#FCF4F6] text-[#1E293B] border border-[#EDB5C1]">
                  Quyền Chủ Nhiệm
                </span>
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Tên Trường Học *
                    </label>
                    <input
                      type="text"
                      value={formConfig.schoolName || ''}
                      onChange={(e) => setFormConfig({ ...formConfig, schoolName: e.target.value })}
                      placeholder="VD: Trường THCS Chu Văn An"
                      className="w-full px-3.5 py-2.5 bg-[#FCF4F6]/30 border border-[#E5B2BD] rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] font-semibold text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Tên Lớp Chủ Nhiệm *
                    </label>
                    <input
                      type="text"
                      value={formConfig.className}
                      onChange={(e) => setFormConfig({ ...formConfig, className: e.target.value })}
                      placeholder="VD: 8A3"
                      className="w-full px-3.5 py-2.5 bg-[#FCF4F6]/30 border border-[#E5B2BD] rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] font-bold text-[#1E293B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Năm Học *
                    </label>
                    <input
                      type="text"
                      value={formConfig.schoolYear}
                      onChange={(e) => setFormConfig({ ...formConfig, schoolYear: e.target.value })}
                      placeholder="VD: 2024 - 2025"
                      className="w-full px-3.5 py-2.5 bg-[#FCF4F6]/30 border border-[#E5B2BD] rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] font-semibold text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Họ và Tên Giáo Viên Chủ Nhiệm *
                    </label>
                    <input
                      type="text"
                      value={formConfig.teacherName}
                      onChange={(e) => setFormConfig({ ...formConfig, teacherName: e.target.value })}
                      placeholder="VD: Cô Lê Thị Kim Thanh"
                      className="w-full px-3.5 py-2.5 bg-[#FCF4F6]/30 border border-[#E5B2BD] rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] font-semibold text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Tên Ứng Dụng
                    </label>
                    <input
                      type="text"
                      value={formConfig.appName}
                      onChange={(e) => setFormConfig({ ...formConfig, appName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#FCF4F6]/30 border border-[#E5B2BD] rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Mật Khẩu Quản Lý Giáo Viên
                    </label>
                    <input
                      type="text"
                      value={formConfig.teacherPassword}
                      onChange={(e) =>
                        setFormConfig({ ...formConfig, teacherPassword: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-[#FCF4F6]/30 border border-[#E5B2BD] rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Danh Sách Các Lớp (Cách nhau dấu phẩy)
                    </label>
                    <input
                      type="text"
                      value={(formConfig.availableClasses || []).join(', ')}
                      onChange={(e) =>
                        setFormConfig({
                          ...formConfig,
                          availableClasses: e.target.value
                            .split(',')
                            .map((c) => c.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="8A3, 9A5, 7A1, 6A2"
                      className="w-full px-3.5 py-2.5 bg-[#FCF4F6]/30 border border-[#E5B2BD] rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]"
                    />
                  </div>
                </div>

                <div className="pt-3 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#EDB5C1] hover:bg-[#E4A7B4] text-[#1E293B] font-black text-xs sm:text-sm rounded-xl shadow-md shadow-[#EDB5C1]/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    <span>Lưu Cài Đặt Lớp Học</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: ĐỒNG BỘ ĐÁM MÂY (SUPABASE CLOUD) */}
          {activeTab === 'cloud' && (
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/80 shadow-xs space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Cloud className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">
                    Đồng Bộ Đám Mây (Supabase Cloud Database)
                  </h3>
                  <p className="text-xs text-gray-500">
                    Lưu trữ dữ liệu thời gian thực trên đám mây, bảo toàn 100% khi đổi máy hoặc truy cập từ xa
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">Trạng thái kết nối:</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        syncStatus.isTableReady
                          ? 'bg-emerald-500'
                          : syncStatus.isConnected
                          ? 'bg-amber-500'
                          : 'bg-gray-400'
                      }`}
                    />
                    <span className="text-xs font-bold text-gray-800">
                      {syncStatus.isTableReady
                        ? 'Đang hoạt động & Đã đồng bộ'
                        : syncStatus.isConnected
                        ? 'Đã kết nối, đang tạo bảng'
                        : 'Lưu cục bộ (LocalStorage)'}
                    </span>
                  </div>
                </div>

                {syncStatus.lastSyncedAt && (
                  <div className="text-xs text-gray-500 flex items-center justify-between">
                    <span>Đồng bộ gần nhất:</span>
                    <span className="font-semibold text-gray-700">{syncStatus.lastSyncedAt}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={onOpenSupabaseModal}
                  className="px-5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-2"
                >
                  <Cloud className="w-4 h-4" />
                  <span>Cấu hình dự án Supabase Cloud</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: SAO LƯU & DỮ LIỆU */}
          {activeTab === 'backup' && (
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/80 shadow-xs space-y-6">
              <div className="pb-3 border-b border-gray-100 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Save className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Sao Lưu & An Toàn Dữ Liệu
                  </h3>
                  <p className="text-xs text-gray-500">
                    Tải về máy tính file sao lưu dự phòng định dạng JSON hoặc phục hồi dữ liệu từ file có sẵn
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Export JSON */}
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-gray-800">
                      Xuất File Sao Lưu Dự Phòng (.JSON)
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Tải về toàn bộ hồ sơ học sinh, điểm số, điểm danh, nề nếp và bảng tin về máy tính cá nhân.
                    </p>
                  </div>
                  <button
                    onClick={handleExportBackup}
                    className="mt-3 w-full py-2.5 px-3 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-gray-600" />
                    <span>Tải file sao lưu JSON</span>
                  </button>
                </div>

                {/* Import JSON */}
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-gray-800">
                      Khôi Phục Từ File Sao Lưu (.JSON)
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Chọn file JSON đã lưu trước đây để phục hồi lại toàn bộ hệ thống lớp.
                    </p>
                  </div>
                  <label className="mt-3 w-full py-2.5 px-3 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center shadow-2xs">
                    <Upload className="w-3.5 h-3.5 text-gray-600" />
                    <span>Chọn file JSON để khôi phục</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportBackupFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Danger zone */}
              <div className="pt-4 border-t border-gray-100 space-y-3">
                <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Khu Vực Nguy Hiểm</span>
                </h4>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          'Khôi phục lại dữ liệu mẫu 8 học sinh ban đầu? Tất cả dữ liệu hiện tại sẽ được thay thế bằng mẫu ban đầu.'
                        )
                      ) {
                        onResetData();
                        onShowToast('Đã khôi phục dữ liệu mẫu ban đầu');
                      }
                    }}
                    className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Khôi phục dữ liệu mẫu ban đầu</span>
                  </button>

                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          'CẢNH BÁO: Hành động này sẽ XÓA SẠCH toàn bộ học sinh, điểm danh, nề nếp và thông báo! Bạn có chắc chắn không?'
                        )
                      ) {
                        onClearAllData();
                        onShowToast('Đã xóa sạch toàn bộ dữ liệu');
                      }
                    }}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa sạch toàn bộ dữ liệu</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: THÊM / CHỈNH SỬA QUY TẮC THI ĐUA */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-[#E5B2BD] shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsRuleModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-[#E5B2BD]/50">
              <div className="w-9 h-9 rounded-xl bg-[#FCF4F6] border border-[#EDB5C1] text-[#1E293B] flex items-center justify-center">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">
                  {editingRuleId ? 'Chỉnh Sửa Quy Tắc Thi Đua' : 'Thêm Quy Tắc Thi Đua Mới'}
                </h3>
                <p className="text-xs text-gray-500">
                  {editingRuleId
                    ? 'Cập nhật nội dung hoặc mức điểm của quy tắc'
                    : 'Tạo quy tắc khen thưởng hoặc vi phạm mới cho lớp'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4">
              {/* Phân loại Type (Toggle buttons) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Phân loại quy tắc <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRuleFormType('plus')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      ruleFormType === 'plus'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>+ Khen thưởng (Cộng điểm)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRuleFormType('minus')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      ruleFormType === 'minus'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>- Vi phạm (Trừ điểm)</span>
                  </button>
                </div>
              </div>

              {/* Tên quy tắc */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Tên quy tắc / Nội dung sự việc <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={ruleFormName}
                  onChange={(e) => setRuleFormName(e.target.value)}
                  placeholder="VD: Nói chuyện riêng, Làm việc tốt..."
                  className="w-full px-3.5 py-2.5 bg-gray-50/70 focus:bg-white border border-gray-200 focus:border-[#EDB5C1] rounded-xl text-xs sm:text-sm font-semibold text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]/40"
                />
              </div>

              {/* Mức điểm */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Mức điểm ({ruleFormType === 'plus' ? 'Cộng +' : 'Trừ -'}){' '}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-2.5 rounded-xl font-black text-sm border ${
                      ruleFormType === 'plus'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {ruleFormType === 'plus' ? '+' : '-'}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={ruleFormPoints}
                    onChange={(e) => setRuleFormPoints(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 px-3.5 py-2.5 bg-gray-50/70 focus:bg-white border border-gray-200 focus:border-[#EDB5C1] rounded-xl text-xs sm:text-sm font-black text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]/40"
                  />
                  <span className="text-xs font-bold text-gray-500">điểm</span>
                </div>
              </div>

              {/* Mô tả / Hướng dẫn áp dụng */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Mô tả / Ghi chú áp dụng (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={ruleFormDesc}
                  onChange={(e) => setRuleFormDesc(e.target.value)}
                  placeholder="VD: Áp dụng khi vi phạm trong giờ học chính khóa"
                  className="w-full px-3.5 py-2.5 bg-gray-50/70 focus:bg-white border border-gray-200 focus:border-[#EDB5C1] rounded-xl text-xs font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#EDB5C1]/40"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#EDB5C1] hover:bg-[#E4A7B4] text-[#1E293B] font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#EDB5C1]/20 active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingRuleId ? 'Lưu thay đổi' : 'Tạo quy tắc'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

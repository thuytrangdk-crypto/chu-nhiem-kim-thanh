import {
  ConductGrade,
  ConductTierConfig,
  DisciplineRecord,
  EmulationConfig,
  Student,
} from '../types';

export const DEFAULT_EMULATION_CONFIG: EmulationConfig = {
  // Điểm khởi đầu của mỗi học sinh trong một học kỳ (mặc định 200 điểm/học kỳ)
  initialPoints: 200,
  periodType: 'semester',

  // Điểm tối thiểu, điểm tối đa; có thể bật/tắt giới hạn
  enableMinScore: false,
  minScore: 0,
  enableMaxScore: false,
  maxScore: 220,

  // Quy tắc tổng hợp học kỳ
  aggregationMethod: 'single_initial', // Điểm khởi đầu 1 lần cho cả học kỳ + Tổng điểm cộng - Tổng điểm trừ

  // 4 mức xếp loại rèn luyện chuẩn theo Thông tư Bộ GD&ĐT
  conductTiers: [
    {
      id: 'tot',
      label: 'Tốt',
      minScore: 105,
      description:
        'Thực hiện xuất sắc nội quy trường lớp, kính trọng thầy cô, đoàn kết giúp đỡ bạn bè, tích cực tham gia phong trào thi đua và các hoạt động chung của lớp.',
      additionalRulesEnabled: false,
      maxViolations: 1,
      downgradeTo: 'Khá',
    },
    {
      id: 'kha',
      label: 'Khá',
      minScore: 90,
      description:
        'Thực hiện tốt nội quy nề nếp, có ý thức rèn luyện và xây dựng tập thể, đôi lúc có thiếu sót nhỏ nhưng đã nhanh chóng tiếp thu và tiến bộ.',
      additionalRulesEnabled: false,
      maxViolations: 3,
      downgradeTo: 'Đạt',
    },
    {
      id: 'dat',
      label: 'Đạt',
      minScore: 70,
      description:
        'Cơ bản thực hiện đúng quy định nề nếp, có cố gắng sửa đổi khuyết điểm khi được nhắc nhở, còn một số vi phạm nhẹ.',
      additionalRulesEnabled: false,
      maxViolations: 6,
      downgradeTo: 'Chưa đạt',
    },
    {
      id: 'chuadat',
      label: 'Chưa đạt',
      minScore: 0, // Dưới mức Đạt (< 70)
      description:
        'Ý thức rèn luyện chưa cao, còn thường xuyên vi phạm nội quy trường lớp hoặc chưa chịu sửa đổi khi được giáo viên nhắc nhở.',
      additionalRulesEnabled: false,
    },
  ],

  version: 1,
  updatedAt: new Date().toISOString(),
  appliedAt: '2024-09-01',
};

/**
 * Kiểm tra tính hợp lệ của thang điểm & ngưỡng xếp loại:
 * - Chấp nhận số hữu hạn (kể cả 0, số âm, số thập phân)
 * - Điều kiện giữa các ngưỡng chỉ là: Tốt > Khá > Đạt
 */
export function validateConductTiers(
  tiers: ConductTierConfig[],
  initialPoints?: number
): {
  isValid: boolean;
  errorMessage?: string;
  fieldErrors?: {
    initialPoints?: string;
    tot?: string;
    kha?: string;
    dat?: string;
  };
} {
  const totTier = tiers.find((t) => t.id === 'tot');
  const khaTier = tiers.find((t) => t.id === 'kha');
  const datTier = tiers.find((t) => t.id === 'dat');

  const errors: {
    initialPoints?: string;
    tot?: string;
    kha?: string;
    dat?: string;
  } = {};

  if (initialPoints !== undefined && !Number.isFinite(initialPoints)) {
    errors.initialPoints = 'Vui lòng nhập điểm ban đầu hợp lệ';
  }

  if (!totTier || !Number.isFinite(totTier.minScore)) {
    errors.tot = 'Vui lòng nhập ngưỡng điểm Tốt hợp lệ';
  }
  if (!khaTier || !Number.isFinite(khaTier.minScore)) {
    errors.kha = 'Vui lòng nhập ngưỡng điểm Khá hợp lệ';
  }
  if (!datTier || !Number.isFinite(datTier.minScore)) {
    errors.dat = 'Vui lòng nhập ngưỡng điểm Đạt hợp lệ';
  }

  if (Object.keys(errors).length > 0) {
    return {
      isValid: false,
      errorMessage: 'Vui lòng nhập đầy đủ các ô điểm hợp lệ.',
      fieldErrors: errors,
    };
  }

  const tScore = totTier!.minScore;
  const kScore = khaTier!.minScore;
  const dScore = datTier!.minScore;

  // Điều kiện giữa các ngưỡng chỉ là: Tốt > Khá > Đạt
  if (tScore <= kScore) {
    errors.tot = `Ngưỡng Tốt (${tScore}) phải lớn hơn ngưỡng Khá (${kScore})`;
    return {
      isValid: false,
      errorMessage: `Ngưỡng Tốt (${tScore}) phải lớn hơn ngưỡng Khá (${kScore})`,
      fieldErrors: errors,
    };
  }

  if (kScore <= dScore) {
    errors.kha = `Ngưỡng Khá (${kScore}) phải lớn hơn ngưỡng Đạt (${dScore})`;
    return {
      isValid: false,
      errorMessage: `Ngưỡng Khá (${kScore}) phải lớn hơn ngưỡng Đạt (${dScore})`,
      fieldErrors: errors,
    };
  }

  return { isValid: true };
}

export interface StudentEvaluationResult {
  initialPoints: number;
  plusPoints: number;
  minusPoints: number; // positive number
  rawTotalPoints: number; // Điểm ban đầu + Tổng điểm thưởng − Tổng điểm vi phạm
  finalTotalPoints: number; // Không tự chặn ở 0 hay điểm ban đầu
  minScoreApplied: boolean;
  maxScoreApplied: boolean;
  suggestedRating: ConductGrade;
  originalTierRating: ConductGrade;
  isDowngraded: boolean;
  downgradeReason: string | null;
  positiveCount: number;
  negativeCount: number;
}

/**
 * Tính điểm thi đua và xếp loại gợi ý rèn luyện cho học sinh theo cấu hình:
 * Điểm thi đua = Điểm ban đầu + Tổng điểm thưởng − Tổng điểm vi phạm
 *
 * Gọi các ngưỡng giáo viên nhập là T, K, D:
 * - Điểm >= T: Tốt
 * - K <= Điểm < T: Khá
 * - D <= Điểm < K: Đạt
 * - Điểm < D: Chưa đạt
 *
 * Không tự chặn điểm tổng ở 0 hoặc điểm ban đầu.
 * Không dùng điều kiện ngầm về số lần vi phạm để thay đổi kết quả của thang điểm này.
 */
export function evaluateStudentEmulation(
  studentId: string,
  periodRecords: DisciplineRecord[],
  config: EmulationConfig = DEFAULT_EMULATION_CONFIG
): StudentEvaluationResult {
  const studentRecords = periodRecords.filter((r) => r.studentId === studentId);

  let plusPoints = 0;
  let minusPoints = 0;
  let positiveCount = 0;
  let negativeCount = 0;

  for (const r of studentRecords) {
    const pts = r.points || 0;
    if (pts > 0) {
      plusPoints += pts;
      positiveCount++;
    } else if (pts < 0) {
      minusPoints += Math.abs(pts);
      negativeCount++;
    }
  }

  const initialPoints =
    config.initialPoints !== undefined && Number.isFinite(config.initialPoints)
      ? config.initialPoints
      : 200;
  // Điểm thi đua = Điểm ban đầu + Tổng điểm thưởng − Tổng điểm vi phạm
  const rawTotalPoints = initialPoints + plusPoints - minusPoints;
  // Không tự chặn điểm tổng ở 0 hoặc điểm ban đầu
  const finalTotalPoints = rawTotalPoints;

  // Lấy 3 ngưỡng T, K, D do giáo viên tự thiết lập
  const totTier = config.conductTiers?.find((t) => t.id === 'tot');
  const khaTier = config.conductTiers?.find((t) => t.id === 'kha');
  const datTier = config.conductTiers?.find((t) => t.id === 'dat');

  const tScore =
    totTier?.minScore !== undefined && Number.isFinite(totTier.minScore)
      ? totTier.minScore
      : 105;
  const kScore =
    khaTier?.minScore !== undefined && Number.isFinite(khaTier.minScore)
      ? khaTier.minScore
      : 90;
  const dScore =
    datTier?.minScore !== undefined && Number.isFinite(datTier.minScore)
      ? datTier.minScore
      : 70;

  let suggestedRating: ConductGrade = 'Chưa đạt';

  // Cách tính chuẩn:
  // - Điểm >= T: Tốt
  // - K <= Điểm < T: Khá
  // - D <= Điểm < K: Đạt
  // - Điểm < D: Chưa đạt
  if (finalTotalPoints >= tScore) {
    suggestedRating = 'Tốt';
  } else if (finalTotalPoints >= kScore) {
    suggestedRating = 'Khá';
  } else if (finalTotalPoints >= dScore) {
    suggestedRating = 'Đạt';
  } else {
    suggestedRating = 'Chưa đạt';
  }

  return {
    initialPoints,
    plusPoints,
    minusPoints,
    rawTotalPoints,
    finalTotalPoints,
    minScoreApplied: false,
    maxScoreApplied: false,
    suggestedRating,
    originalTierRating: suggestedRating,
    isDowngraded: false,
    downgradeReason: null,
    positiveCount,
    negativeCount,
  };
}

/**
 * Lấy cấu hình thi đua theo từng lớp và năm học (hoặc fallback cấu hình mặc định)
 */
export function getEmulationConfigForClass(
  classConfigs: Record<string, EmulationConfig> | undefined,
  activeConfig: EmulationConfig | undefined,
  className: string,
  schoolYear: string
): EmulationConfig {
  const normalizedYear = (schoolYear || '').trim().replace(/(\d{4})\s*[-–]\s*(\d{4})/, '$1 - $2');
  const key = `${className}_${schoolYear}`;
  const normalizedKey = `${className}_${normalizedYear}`;
  if (classConfigs) {
    if (classConfigs[key]) return classConfigs[key];
    if (classConfigs[normalizedKey]) return classConfigs[normalizedKey];
  }
  if (activeConfig) {
    return activeConfig;
  }
  return DEFAULT_EMULATION_CONFIG;
}

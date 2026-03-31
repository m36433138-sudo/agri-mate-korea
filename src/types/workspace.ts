export type TaskCategory = 'repair' | 'sales' | 'parts' | 'quotation' | 'admin' | 'finance' | 'other';
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type LogType = 'call' | 'visit' | 'sms' | 'kakao' | 'repair_work' | 'internal' | 'other';
export type DocType = 'quotation' | 'order' | 'subsidy' | 'tax_invoice' | 'purchase';
export type FinanceRecordType = 'receivable' | 'payment' | 'refund';

export interface Task {
  id: string;
  user_id: string;
  created_by: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  related_customer_id: string | null;
  related_machine_id: string | null;
  created_at: string;
  // joined
  customers?: { id: string; name: string } | null;
  machines?: { id: string; model_name: string; serial_number: string } | null;
}

export interface Log {
  id: string;
  logged_by: string;
  log_type: LogType;
  log_date: string;
  title: string;
  content: string | null;
  related_customer_id: string | null;
  related_machine_id: string | null;
  related_task_id: string | null;
  next_action: string | null;
  next_action_date: string | null;
  created_at: string;
  // joined
  customers?: { id: string; name: string } | null;
  machines?: { id: string; model_name: string; serial_number: string } | null;
}

export interface Document {
  id: string;
  created_by: string;
  doc_type: DocType;
  title: string;
  customer_id: string | null;
  machine_id: string | null;
  amount: number | null;
  issued_date: string;
  valid_until: string | null;
  status: string;
  notes: string | null;
  file_url: string | null;
  created_at: string;
  // joined
  customers?: { id: string; name: string } | null;
  machines?: { id: string; model_name: string; serial_number: string } | null;
}

export interface FinanceRecord {
  id: string;
  created_by: string;
  record_type: FinanceRecordType;
  customer_id: string | null;
  document_id: string | null;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  is_paid: boolean;
  notes: string | null;
  created_at: string;
  // joined
  customers?: { id: string; name: string } | null;
  documents?: { id: string; title: string; doc_type: string } | null;
}

export interface WorkspaceFilters {
  myOnly: boolean;
  category: string;
  dateFrom: string;
  dateTo: string;
  customerSearch: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: 'task' | 'log' | 'document' | 'finance';
  color: string;
}

// ── Labels & Constants ────────────────────────────────────────

export const CATEGORY_COLORS: Record<string, string> = {
  repair:    'bg-blue-100 text-blue-700 border-blue-200',
  sales:     'bg-green-100 text-green-700 border-green-200',
  parts:     'bg-orange-100 text-orange-700 border-orange-200',
  quotation: 'bg-purple-100 text-purple-700 border-purple-200',
  finance:   'bg-red-100 text-red-700 border-red-200',
  admin:     'bg-gray-100 text-gray-600 border-gray-200',
  other:     'bg-slate-100 text-slate-600 border-slate-200',
};

export const CATEGORY_DOT_COLORS: Record<string, string> = {
  repair:    '#3B82F6',
  sales:     '#22C55E',
  parts:     '#F97316',
  quotation: '#A855F7',
  finance:   '#EF4444',
  admin:     '#6B7280',
  other:     '#94A3B8',
};

export const CATEGORY_LABELS: Record<string, string> = {
  repair:    '수리',
  sales:     '영업',
  parts:     '부품',
  quotation: '견적',
  finance:   '재무',
  admin:     '행정',
  other:     '기타',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo:        '미완료',
  in_progress: '진행중',
  done:        '완료',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high:   '높음',
  medium: '보통',
  low:    '낮음',
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high:   'text-red-600',
  medium: 'text-yellow-600',
  low:    'text-slate-400',
};

export const LOG_TYPE_LABELS: Record<LogType, string> = {
  call:        '전화',
  visit:       '방문',
  sms:         'SMS',
  kakao:       '카카오',
  repair_work: '정비작업',
  internal:    '내부',
  other:       '기타',
};

export const LOG_TYPE_ICONS: Record<LogType, string> = {
  call:        '📞',
  visit:       '🚗',
  sms:         '💬',
  kakao:       '💬',
  repair_work: '🔧',
  internal:    '📝',
  other:       '📌',
};

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  quotation:   '견적서',
  order:       '발주서',
  subsidy:     '보조금',
  tax_invoice: '세금계산서',
  purchase:    '매입서류',
};

export const DOC_STATUS_OPTIONS: Record<DocType, { value: string; label: string }[]> = {
  quotation: [
    { value: 'issued',    label: '발행' },
    { value: 'reviewing', label: '검토중' },
    { value: 'accepted',  label: '수락' },
    { value: 'rejected',  label: '거절' },
    { value: 'expired',   label: '만료' },
  ],
  order: [
    { value: 'draft',             label: '임시' },
    { value: 'ordered',           label: '발주완료' },
    { value: 'partially_arrived', label: '일부입고' },
    { value: 'arrived',           label: '전량입고' },
  ],
  subsidy: [
    { value: 'preparing', label: '준비중' },
    { value: 'submitted', label: '제출완료' },
    { value: 'approved',  label: '승인' },
    { value: 'rejected',  label: '반려' },
  ],
  tax_invoice: [
    { value: 'issued',    label: '발행' },
    { value: 'received',  label: '수령' },
    { value: 'cancelled', label: '취소' },
  ],
  purchase: [
    { value: 'pending',  label: '미결제' },
    { value: 'paid',     label: '결제완료' },
    { value: 'overdue',  label: '연체' },
  ],
};

export const TEAM_DEFAULT_CATEGORY: Record<string, TaskCategory> = {
  '기사팀': 'repair',
  '영업팀': 'sales',
  '사무팀': 'admin',
};

export const FINANCE_TYPE_LABELS: Record<FinanceRecordType, string> = {
  receivable: '미수금',
  payment:    '입금',
  refund:     '환불',
};

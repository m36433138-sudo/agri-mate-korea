import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, ExternalLink, DollarSign } from "lucide-react";
import type { Document, DocType, WorkspaceFilters } from "@/types/workspace";
import { DOC_TYPE_LABELS } from "@/types/workspace";
import { useDocuments } from "@/hooks/useDocuments";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, parseISO } from "date-fns";

const DOC_TYPE_TABS: Array<{ key: string; label: string }> = [
  { key: "all",         label: "전체" },
  { key: "quotation",   label: "견적서" },
  { key: "order",       label: "발주서" },
  { key: "subsidy",     label: "보조금" },
  { key: "tax_invoice", label: "세금계산서" },
  { key: "purchase",    label: "매입서류" },
];

interface Props {
  filters: WorkspaceFilters;
  onAdd: () => void;
  onEdit: (doc: Document) => void;
  onCreateFinance: (docId: string) => void;
}

export function DocumentList({ filters, onAdd, onEdit, onCreateFinance }: Props) {
  const { documents, isLoading, deleteDocument } = useDocuments();
  const { userId, isAdmin } = useUserRole();
  const { toast } = useToast();

  const today = new Date().toISOString().split("T")[0];

  // active doc type tab (로컬 상태로 관리)
  const [docTypeTab, setDocTypeTab] = useState("all");

  // 필터 적용
  const filtered = documents.filter((d) => {
    if (filters.myOnly && d.created_by !== userId) return false;
    if (docTypeTab !== "all" && d.doc_type !== docTypeTab) return false;
    if (filters.dateFrom && d.issued_date < filters.dateFrom) return false;
    if (filters.dateTo && d.issued_date > filters.dateTo) return false;
    if (filters.customerSearch) {
      const search = filters.customerSearch.toLowerCase();
      const customerName = d.customers?.name?.toLowerCase() ?? "";
      if (!customerName.includes(search) && !d.title.toLowerCase().includes(search))
        return false;
    }
    return true;
  });

  const handleDelete = async (doc: Document) => {
    if (!window.confirm(`"${doc.title}" 을 삭제하시겠어요?`)) return;
    try {
      await deleteDocument.mutateAsync(doc.id);
      toast({ title: "삭제됐어요." });
    } catch {
      toast({ title: "삭제 실패", variant: "destructive" });
    }
  };

  const getRowStyle = (doc: Document): string => {
    if (doc.doc_type !== "quotation" || !doc.valid_until) return "";
    if (doc.valid_until < today) return "bg-slate-50 opacity-60";
    const daysLeft = differenceInDays(parseISO(doc.valid_until), new Date());
    if (daysLeft <= 3) return "bg-yellow-50";
    return "";
  };

  const getValidUntilBadge = (doc: Document) => {
    if (doc.doc_type !== "quotation" || !doc.valid_until) return null;
    if (doc.valid_until < today) {
      return <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-500">만료</Badge>;
    }
    const daysLeft = differenceInDays(parseISO(doc.valid_until), new Date());
    if (daysLeft <= 3) {
      return (
        <Badge variant="outline" className="text-[10px] bg-yellow-100 text-yellow-700">
          D-{daysLeft}
        </Badge>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* doc type 탭 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 flex-wrap">
          {DOC_TYPE_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDocTypeTab(key)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                docTypeTab === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={onAdd} className="gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" /> 문서 작성
        </Button>
      </div>

      {/* 테이블 */}
      {filtered.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-12 border border-dashed rounded-lg">
          문서가 없어요
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">고객</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">제목</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground hidden md:table-cell">유형</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">금액</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground hidden md:table-cell">상태</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((doc) => (
                  <tr key={doc.id} className={`hover:bg-muted/30 transition-colors ${getRowStyle(doc)}`}>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {doc.customers?.name ?? "-"}
                    </td>
                    <td className="px-3 py-2 font-medium max-w-[200px]">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{doc.title}</span>
                        {getValidUntilBadge(doc)}
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      <Badge variant="outline" className="text-[10px]">
                        {DOC_TYPE_LABELS[doc.doc_type as DocType]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-medium">
                      {doc.amount != null
                        ? doc.amount.toLocaleString("ko-KR") + "원"
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-center hidden md:table-cell">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {doc.file_url && (
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => onCreateFinance(doc.id)}
                          className="p-0.5 rounded hover:bg-green-100 text-muted-foreground hover:text-green-600 transition-colors"
                          title="미수금 등록"
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                        </button>
                        {(isAdmin || doc.created_by === userId) && (
                          <>
                            <button
                              onClick={() => onEdit(doc)}
                              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(doc)}
                              className="p-0.5 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


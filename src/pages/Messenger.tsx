import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare, Send, Paperclip, Search, Plus, Users, X, Download,
  Trash2, LogOut, Tractor, User as UserIcon, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { CustomerSearchInput } from "@/components/CustomerSearchInput";
import { MachineSearchInput } from "@/components/MachineSearchInput";
import {
  useChatRooms, useChatMessages, useChatStaff, useMessengerActions,
  useMessageSearch, getChatFileUrl, type RoomSummary,
} from "@/hooks/useMessenger";

function formatTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }) +
      " " + d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function Messenger() {
  const { userId, isCustomer } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { rooms, isLoading } = useChatRooms();
  const { data: staff = [] } = useChatStaff();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [newRoomOpen, setNewRoomOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [roomFilter, setRoomFilter] = useState("");

  useEffect(() => {
    if (isCustomer) navigate("/", { replace: true });
  }, [isCustomer, navigate]);

  const nameOf = (id: string) =>
    staff.find((s) => s.user_id === id)?.display_name ?? "알 수 없음";

  const roomTitle = (room: RoomSummary) => {
    if (room.room_type === "direct") {
      const other = room.memberIds.find((id) => id !== userId);
      return other ? nameOf(other) : "1:1 대화";
    }
    return room.name || "단체 대화방";
  };

  const filteredRooms = useMemo(() => {
    const t = roomFilter.trim();
    if (!t) return rooms;
    return rooms.filter((r) => roomTitle(r).includes(t));
  }, [rooms, roomFilter, staff, userId]);

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;

  useEffect(() => {
    if (!activeRoomId && rooms.length > 0) setActiveRoomId(rooms[0].id);
  }, [rooms, activeRoomId]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            사내 메신저
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            관리자·직원 전용 · 1:1 및 단체 대화
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSearchOpen(true)}>
            <Search className="h-4 w-4 mr-1.5" /> 메시지 검색
          </Button>
          <Button size="sm" onClick={() => setNewRoomOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> 새 대화
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 h-[calc(100vh-190px)] min-h-[500px]">
        {/* 대화방 목록 */}
        <div className="rounded-2xl border border-border bg-card flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border">
            <Input
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              placeholder="대화방 검색"
              className="h-9"
            />
          </div>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">불러오는 중…</div>
            ) : filteredRooms.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                대화방이 없습니다.<br />“새 대화”로 시작해보세요.
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredRooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => setActiveRoomId(room.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                      activeRoomId === room.id ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {room.room_type === "direct"
                        ? <UserIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        : <Users className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <span className="text-sm font-semibold truncate flex-1">{roomTitle(room)}</span>
                      {room.unread > 0 && (
                        <Badge className="h-5 min-w-5 px-1.5 justify-center">{room.unread}</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-xs text-muted-foreground truncate">
                        {room.last_message_preview || "새 대화방"}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatTime(room.last_message_at)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* 대화 영역 */}
        {activeRoom ? (
          <ChatPane
            room={activeRoom}
            title={roomTitle(activeRoom)}
            nameOf={nameOf}
            onLeft={() => setActiveRoomId(null)}
          />
        ) : (
          <div className="rounded-2xl border border-border bg-card flex items-center justify-center text-sm text-muted-foreground">
            대화방을 선택하세요.
          </div>
        )}
      </div>

      <NewRoomDialog open={newRoomOpen} onOpenChange={setNewRoomOpen} onCreated={setActiveRoomId} />
      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        rooms={rooms}
        roomTitle={roomTitle}
        nameOf={nameOf}
        onJump={(roomId) => { setActiveRoomId(roomId); setSearchOpen(false); }}
      />
      {!isLoading && (
        <p className="text-xs text-muted-foreground">
          {rooms.length}개 대화방 · 첨부파일은 대화 참여자만 열 수 있습니다.
        </p>
      )}
    </div>
  );
}

/* ───────── 대화 패널 ───────── */
function ChatPane({ room, title, nameOf, onLeft }: {
  room: RoomSummary;
  title: string;
  nameOf: (id: string) => string;
  onLeft: () => void;
}) {
  const { userId } = useUserRole();
  const { toast } = useToast();
  const { data: messages = [] } = useChatMessages(room.id);
  const { sendMessage, markRead, deleteMessage, leaveRoom } = useMessengerActions();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (room.unread > 0) markRead.mutate(room.id);
  }, [room.id, room.unread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    if (!text.trim() && !file) return;
    try {
      await sendMessage.mutateAsync({ roomId: room.id, content: text, file });
      setText("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      toast({ title: "전송 실패", description: e.message ?? "다시 시도해주세요.", variant: "destructive" });
    }
  };

  const openFile = async (path: string) => {
    const url = await getChatFileUrl(path);
    if (url) window.open(url, "_blank");
    else toast({ title: "파일을 열 수 없습니다.", variant: "destructive" });
  };

  return (
    <div className="rounded-2xl border border-border bg-card flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-bold truncate">{title}</h2>
          <p className="text-xs text-muted-foreground truncate">
            {room.memberIds.map(nameOf).join(", ")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {room.related_customer_id && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <UserIcon className="h-3 w-3" /> 고객 연결
            </Badge>
          )}
          {room.related_machine_id && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Tractor className="h-3 w-3" /> 기계 연결
            </Badge>
          )}
          <Button
            variant="ghost" size="sm"
            onClick={() => {
              if (!confirm("이 대화방에서 나가시겠습니까?")) return;
              leaveRoom.mutate(room.id, { onSuccess: onLeft });
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              첫 메시지를 보내보세요.
            </p>
          )}
          {messages.map((m) => {
            const mine = m.sender_id === userId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  {!mine && (
                    <span className="text-[11px] text-muted-foreground px-1">{nameOf(m.sender_id)}</span>
                  )}
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
                      mine
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {m.content}
                    {m.file_path && (
                      <button
                        onClick={() => openFile(m.file_path!)}
                        className={`mt-1.5 flex items-center gap-1.5 text-xs underline ${m.content ? "" : ""}`}
                      >
                        <Download className="h-3.5 w-3.5" />
                        {m.file_name} {formatSize(m.file_size) && `(${formatSize(m.file_size)})`}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] text-muted-foreground">{formatTime(m.created_at)}</span>
                    {mine && (
                      <button
                        onClick={() => deleteMessage.mutate(m.id)}
                        className="text-[10px] text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border p-3 space-y-2">
        {file && (
          <div className="flex items-center gap-2 text-xs bg-muted rounded-lg px-2.5 py-1.5">
            <Paperclip className="h-3.5 w-3.5" />
            <span className="truncate flex-1">{file.name} ({formatSize(file.size)})</span>
            <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => fileRef.current?.click()}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="메시지 입력 (Enter 전송 / Shift+Enter 줄바꿈)"
            rows={1}
            className="min-h-10 max-h-32 resize-none"
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={handleSend}
            disabled={sendMessage.isPending || (!text.trim() && !file)}
          >
            {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ───────── 새 대화 만들기 ───────── */
function NewRoomDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (roomId: string) => void;
}) {
  const { userId } = useUserRole();
  const { toast } = useToast();
  const { data: staff = [] } = useChatStaff();
  const { openDirect, createGroup } = useMessengerActions();
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [machineName, setMachineName] = useState("");
  const [machineId, setMachineId] = useState<string | null>(null);

  const others = staff.filter((s) => s.user_id !== userId);

  const reset = () => {
    setGroupName(""); setSelected([]);
    setCustomerName(""); setCustomerId(null);
    setMachineName(""); setMachineId(null);
  };

  const startDirect = async (id: string) => {
    try {
      const roomId = await openDirect.mutateAsync(id);
      onCreated(roomId);
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast({ title: "대화방 생성 실패", description: e.message, variant: "destructive" });
    }
  };

  const startGroup = async () => {
    if (!groupName.trim()) return toast({ title: "대화방 이름을 입력해주세요.", variant: "destructive" });
    if (selected.length === 0) return toast({ title: "참여자를 선택해주세요.", variant: "destructive" });
    try {
      const roomId = await createGroup.mutateAsync({
        name: groupName, memberIds: selected, customerId, machineId,
      });
      onCreated(roomId);
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast({ title: "대화방 생성 실패", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>새 대화</DialogTitle></DialogHeader>
        <Tabs defaultValue="direct">
          <TabsList className="w-full">
            <TabsTrigger value="direct" className="flex-1">1:1 대화</TabsTrigger>
            <TabsTrigger value="group" className="flex-1">단체 대화방</TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="space-y-1 max-h-80 overflow-y-auto mt-3">
            {others.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">대화 가능한 직원이 없습니다.</p>
            )}
            {others.map((s) => (
              <button
                key={s.user_id}
                onClick={() => startDirect(s.user_id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent text-left"
              >
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                  {s.display_name[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{s.display_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[s.role === "admin" ? "관리자" : "직원", s.team, s.branch].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </button>
            ))}
          </TabsContent>

          <TabsContent value="group" className="space-y-3 mt-3">
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="대화방 이름 (예: 장흥 기사팀)"
            />
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">참여자</p>
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-border p-2">
                {others.map((s) => (
                  <label key={s.user_id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-accent cursor-pointer">
                    <Checkbox
                      checked={selected.includes(s.user_id)}
                      onCheckedChange={(c) =>
                        setSelected((prev) => c ? [...prev, s.user_id] : prev.filter((id) => id !== s.user_id))
                      }
                    />
                    <span className="text-sm">{s.display_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {[s.team, s.branch].filter(Boolean).join(" · ")}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">관련 고객 (선택)</p>
                <CustomerSearchInput
                  value={customerName}
                  onChange={(v) => { setCustomerName(v); if (!v) setCustomerId(null); }}
                  onSelect={(c) => { setCustomerName(c.name); setCustomerId(c.id); }}
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">관련 기계 (선택)</p>
                <MachineSearchInput
                  value={machineName}
                  customerId={customerId}
                  onChange={(v) => { setMachineName(v); if (!v) setMachineId(null); }}
                  onSelect={(m) => { setMachineName(m.model_name); setMachineId(m.id); }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={startGroup} disabled={createGroup.isPending} className="w-full">
                {createGroup.isPending ? "만드는 중…" : "대화방 만들기"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/* ───────── 메시지 검색 ───────── */
function SearchDialog({ open, onOpenChange, rooms, roomTitle, nameOf, onJump }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rooms: RoomSummary[];
  roomTitle: (r: RoomSummary) => string;
  nameOf: (id: string) => string;
  onJump: (roomId: string) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const { data: results = [], isFetching } = useMessageSearch(keyword);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>메시지 검색</DialogTitle></DialogHeader>
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="두 글자 이상 입력"
          autoFocus
        />
        <div className="max-h-80 overflow-y-auto space-y-1">
          {isFetching && <p className="text-sm text-muted-foreground py-4 text-center">검색 중…</p>}
          {!isFetching && keyword.trim().length >= 2 && results.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">검색 결과가 없습니다.</p>
          )}
          {results.map((m) => {
            const room = rooms.find((r) => r.id === m.room_id);
            return (
              <button
                key={m.id}
                onClick={() => onJump(m.room_id)}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-accent"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-primary truncate">
                    {room ? roomTitle(room) : "대화방"}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatTime(m.created_at)}
                  </span>
                </div>
                <p className="text-sm truncate">{m.content}</p>
                <p className="text-[10px] text-muted-foreground">{nameOf(m.sender_id)}</p>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

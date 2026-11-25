import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getAutoLogin, getLastLoginId, setAutoLogin as saveAutoLogin, setLastLoginId } from "@/lib/authStorage";
import { withRetry, classifyTransient, describeReason } from "@/lib/retry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Auth() {
  const [loginId, setLoginId] = useState(getLastLoginId);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [retryInfo, setRetryInfo] = useState<string | null>(null);
  const [autoLogin, setAutoLogin] = useState(getAutoLogin);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setRetryInfo(null);

    try {
      const email = loginId.includes("@") ? loginId : `${loginId}@ym.local`;
      saveAutoLogin(autoLogin);
      const { error } = await withRetry(
        () => supabase.auth.signInWithPassword({ email, password }),
        {
          retries: 3,
          onAttempt: (attempt, reason) => {
            setRetryInfo(`${describeReason(reason)} 자동 재시도 중… (${attempt}/3)`);
          },
        },
      );
      if (error) throw error;
      setLastLoginId(loginId.trim());
      setRetryInfo(null);
      navigate("/");
    } catch (error: any) {
      const reason = classifyTransient(error) ?? (error as any)?.reason ?? null;
      if (reason) {
        toast({
          title: "로그인 실패 (서버 응답 불가)",
          description: `${describeReason(reason)} 잠시 후 다시 시도해주세요.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "로그인 실패",
          description: error.message === "Invalid login credentials"
            ? "아이디 또는 비밀번호가 올바르지 않습니다."
            : (error.message ?? "알 수 없는 오류가 발생했습니다."),
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
      setRetryInfo(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <span className="dark:bg-white dark:rounded-2xl dark:px-4 dark:py-3">
              <img src="/brand/gwangmun-logo.png" alt="GWANGMUN 광문농기계" className="h-14 w-auto max-w-full" />
            </span>
          </div>
          <CardTitle className="text-2xl font-bold">CSGM 관리 시스템</CardTitle>
          <CardDescription>로그인하여 시스템에 접속하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="loginId">아이디 *</Label>
              <Input
                id="loginId"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="ym1234 또는 이메일"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호 *</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                required
                minLength={6}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="autoLogin"
                checked={autoLogin}
                onCheckedChange={(checked) => setAutoLogin(checked === true)}
              />
              <Label htmlFor="autoLogin" className="text-sm font-normal cursor-pointer">
                자동 로그인 <span className="text-muted-foreground">(앱을 닫아도 로그인 유지 · 공용 PC는 끄세요)</span>
              </Label>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              로그인
            </Button>
            {retryInfo && (
              <p className="text-xs text-center text-muted-foreground animate-pulse">
                {retryInfo}
              </p>
            )}
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            계정이 없으시면 관리자에게 문의하세요.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

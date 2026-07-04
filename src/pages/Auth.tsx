import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { signUpSchema, signInSchema } from "@/lib/authSchemas";
import { Separator } from "@/components/ui/separator";
import TwoFactorSetup from "@/components/TwoFactorSetup";
import TwoFactorVerify from "@/components/TwoFactorVerify";
import TurnstileWidget from "@/components/TurnstileWidget";
import AuthStepper, { AuthStep as StepperStep } from "@/components/AuthStepper";
import { Mail, Loader2 } from "lucide-react";

const SLTV_CLIENT_ID = "aa0b8e6fea64873f8355043e6b3a42ff";
const SLTV_API = "https://sltvid.lovable.app";

type AuthStep = "login" | "2fa-setup" | "2fa-verify" | "email-pending";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [sltvLoading, setSltvLoading] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>("login");
  const [resendingEmail, setResendingEmail] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | undefined>(undefined);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    checkSession();
    // Загружаем публичный Turnstile site key из edge function
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-config`)
      .then((r) => r.json())
      .then((d) => setTurnstileSiteKey(d.turnstileSiteKey || undefined))
      .catch(() => {});
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await check2FAStatus();
    }
  };

  const check2FAStatus = async () => {
    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totpFactors = factorsData?.totp || [];
      const verifiedFactors = totpFactors.filter((f) => f.status === "verified");

      if (verifiedFactors.length === 0) {
        // No 2FA set up - require setup
        setAuthStep("2fa-setup");
      } else {
        // 2FA is set up - check current AAL level
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        
        if (aalData?.currentLevel === "aal1" && aalData?.nextLevel === "aal2") {
          // Need to verify 2FA
          setAuthStep("2fa-verify");
        } else {
          // Fully authenticated
          navigate("/");
        }
      }
    } catch (error) {
      console.error("2FA check error:", error);
      navigate("/");
    }
  };

  // Handle SLTV callback
  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      handleSltvCallback(code);
    }
  }, [searchParams]);

  const handleSltvCallback = async (code: string) => {
    setSltvLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sltv-callback?code=${code}&redirect_uri=${encodeURIComponent(window.location.origin + "/auth")}`,
        { method: "GET" }
      );

      const data = await response.json();
      console.log("SLTV callback response:", data);

      if (!response.ok) {
        throw new Error(data.error || data.details || "SLTV login failed");
      }

      if (data.token_hash) {
        // Try verifyOtp first
        const { error } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: "magiclink",
        });

        if (error) {
          console.warn("verifyOtp failed, trying token:", error.message);
          // Fallback: try with email + token if available
          if (data.email && data.token) {
            const { error: tokenError } = await supabase.auth.verifyOtp({
              email: data.email,
              token: data.token,
              type: "magiclink",
            });
            if (tokenError) throw tokenError;
          } else {
            throw error;
          }
        }

        toast({
          title: "Вход выполнен",
          description: "Добро пожаловать через SLTV ID!",
        });
        
        await check2FAStatus();
      }
    } catch (error: any) {
      console.error("SLTV error:", error);
      toast({
        title: "Ошибка SLTV",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSltvLoading(false);
      window.history.replaceState({}, document.title, "/auth");
    }
  };

  const handleSltvLogin = () => {
    const redirectUri = encodeURIComponent(window.location.origin + "/auth");
    const authUrl = `${SLTV_API}/oauth/authorize?client_id=${SLTV_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=openid profile email`;
    window.location.href = authUrl;
  };

  const verifyTurnstile = async (): Promise<boolean> => {
    if (!turnstileSiteKey) return true; // нет ключа — проверка отключена
    if (!turnstileToken) {
      toast({ title: "Подтвердите, что вы не робот", variant: "destructive" });
      return false;
    }
    try {
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-turnstile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: turnstileToken }),
      });
      const d = await r.json();
      if (!d.success) {
        toast({ title: "Проверка не пройдена", description: "Попробуйте ещё раз", variant: "destructive" });
        return false;
      }
      return true;
    } catch {
      return true; // не блокируем при сетевой ошибке
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (!(await verifyTurnstile())) { setLoading(false); return; }

    try {
      const validation = signUpSchema.safeParse({
        email,
        password,
        username: username || undefined,
      });

      if (!validation.success) {
        const firstError = validation.error.issues[0];
        toast({
          title: "Ошибка валидации",
          description: firstError.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            username: username || email.split("@")[0],
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Подтвердите email",
        description: "Мы отправили письмо со ссылкой подтверждения. Перейдите по ней, затем войдите и настройте 2FA.",
        duration: 10000,
      });
      setPendingEmail(email);
      setAuthStep("email-pending");
      setLoading(false);
      return;
    } catch (error: any) {
      toast({
        title: "Ошибка регистрации",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (!(await verifyTurnstile())) { setLoading(false); return; }

    try {
      let loginEmail = loginIdentifier.trim();

      // If not an email, look up by username (supports Cyrillic)
      if (!loginEmail.includes("@")) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id")
          .ilike("username", loginEmail)
          .maybeSingle();

        if (!profileData) {
          toast({ title: "Пользователь не найден", description: "Проверьте логин или email", variant: "destructive" });
          setLoading(false);
          return;
        }

        // Get email from auth via security definer function
        const { data: userData, error: rpcError } = await supabase.rpc("get_user_email_by_id" as any, { _user_id: profileData.id });
        if (rpcError || !userData) {
          toast({ title: "Ошибка", description: "Не удалось найти email для этого пользователя. Попробуйте войти через email.", variant: "destructive" });
          setLoading(false);
          return;
        }
        loginEmail = userData as string;
      }

      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (error) throw error;

      // Check if user is a system bot (block login)
      if (signInData.user) {
        const { data: protectedUser } = await supabase
          .from("protected_users")
          .select("protection_type")
          .eq("user_id", signInData.user.id)
          .maybeSingle();

        if (protectedUser?.protection_type === "system_bot") {
          await supabase.auth.signOut();
          toast({
            title: "Доступ запрещён",
            description: "Этот аккаунт является системным ботом",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      await check2FAStatus();
    } catch (error: any) {
      toast({
        title: "Ошибка входа",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getSafeNext = (): string => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("next");
    if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
    return raw;
  };

  const handle2FASetupComplete = () => {
    toast({ title: "2FA настроен успешно!" });
    navigate(getSafeNext());
  };

  const handle2FAVerifySuccess = () => {
    navigate(getSafeNext());
  };


  const handle2FACancel = () => {
    setAuthStep("login");
  };

  const handleResendConfirmation = async () => {
    if (!pendingEmail) return;
    setResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingEmail,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      toast({ title: "Письмо отправлено повторно", description: pendingEmail });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setResendingEmail(false);
    }
  };

  // Email-pending screen
  if (authStep === "email-pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Подтвердите email</CardTitle>
            <CardDescription>Шаг 2 из 3 — после подтверждения email будет настройка 2FA</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AuthStepper current="email" />
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted">
              <Mail className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm">
                Мы отправили письмо на <strong>{pendingEmail}</strong>. Перейдите по ссылке из письма, затем вернитесь и войдите.
              </div>
            </div>
            <Button onClick={handleResendConfirmation} disabled={resendingEmail} className="w-full" variant="outline">
              {resendingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
              Отправить код повторно
            </Button>
            <Button onClick={() => setAuthStep("login")} variant="ghost" className="w-full">
              Я подтвердил — войти
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }



  // Render 2FA setup/verify screens
  if (authStep === "2fa-setup") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4">
          <AuthStepper current="2fa" />
          <TwoFactorSetup onComplete={handle2FASetupComplete} />
        </div>
      </div>
    );
  }

  if (authStep === "2fa-verify") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4">
          <AuthStepper current="2fa" />
          <TwoFactorVerify onSuccess={handle2FAVerifySuccess} onCancel={handle2FACancel} />
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">ProHub</CardTitle>
          <CardDescription>Форум разработчиков и профессионалов</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthStepper current="register" />
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Вход</TabsTrigger>
              <TabsTrigger value="signup">Регистрация</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-identifier">Email или логин</Label>
                  <Input
                    id="signin-identifier"
                    type="text"
                    placeholder="email или username"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Пароль</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <TurnstileWidget siteKey={turnstileSiteKey} onVerify={setTurnstileToken} />
                <Button type="submit" className="w-full" disabled={loading || sltvLoading}>
                  {loading ? "Загрузка..." : "Войти"}
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">или</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleSltvLogin}
                  disabled={loading || sltvLoading}
                >
                  {sltvLoading ? "Загрузка..." : "Войти с помощью SLTV ID"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-username">Имя пользователя</Label>
                  <Input
                    id="signup-username"
                    type="text"
                    placeholder="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Пароль</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <TurnstileWidget siteKey={turnstileSiteKey} onVerify={setTurnstileToken} />
                <Button type="submit" className="w-full" disabled={loading || sltvLoading}>
                  {loading ? "Загрузка..." : "Зарегистрироваться"}
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">или</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleSltvLogin}
                  disabled={loading || sltvLoading}
                >
                  {sltvLoading ? "Загрузка..." : "Войти с помощью SLTV ID"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;

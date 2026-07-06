import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { 
  Users, 
  Shield, 
  FileText, 
  Video, 
  Search,
  BadgeCheck,
  Crown,
  UserCog,
  Flag,
  Puzzle,
  Layout,
  FolderOpen,
  Settings,
  RefreshCw,
  Pin,
  Lock as LockIcon
} from "lucide-react";
import VerifiedBadge from "@/components/VerifiedBadge";
import BannedUserInlineBadge from "@/components/BannedUserInlineBadge";
import AdminReportsTab from "@/components/AdminReportsTab";
import AdminPluginsTab from "@/components/admin/AdminPluginsTab";
import AdminTemplatesTab from "@/components/admin/AdminTemplatesTab";
import AdminSectionsTab from "@/components/admin/AdminSectionsTab";
import AdminSettingsTab from "@/components/admin/AdminSettingsTab";
import AdminInactiveRenameTab from "@/components/admin/AdminInactiveRenameTab";
import AdminSubForumsTab from "@/components/admin/AdminSubForumsTab";
import AdminAuditLogTab from "@/components/admin/AdminAuditLogTab";
import AdminBrandsTab from "@/components/admin/AdminBrandsTab";

interface User {
  id: string;
  username: string;
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
  role?: string;
}

interface ContentItem {
  id: string;
  title: string;
  is_hidden: boolean;
  is_pinned?: boolean;
  is_locked?: boolean;
  created_at: string;
  user_id: string;
  profiles?: { username: string };
}

interface VerificationRequest {
  id: string;
  user_id: string;
  reason: string;
  status: string;
  reject_reason: string | null;
  created_at: string;
  profiles?: { username: string; avatar_url: string | null };
}

const AdminPanel = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [topics, setTopics] = useState<ContentItem[]>([]);
  const [resources, setResources] = useState<ContentItem[]>([]);
  const [videos, setVideos] = useState<ContentItem[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: roleLoading } = useUserRole();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast({
        title: "Доступ запрещён",
        description: "У вас нет прав для доступа к админ-панели",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [isAdmin, roleLoading, navigate, toast]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load users with their roles
      const { data: usersData } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (usersData) {
        const usersWithRoles = await Promise.all(
          usersData.map(async (user) => {
            const { data: roleData } = await supabase.rpc("get_user_role", {
              _user_id: user.id,
            });
            return { ...user, role: roleData || "newbie" };
          })
        );
        setUsers(usersWithRoles);
      }

      // Load topics
      const { data: topicsData } = await supabase
        .from("topics")
        .select("id, title, is_hidden, is_pinned, is_locked, created_at, user_id, profiles(username)")
        .order("created_at", { ascending: false })
        .limit(50);
      setTopics(topicsData || []);

      // Load resources
      const { data: resourcesData } = await supabase
        .from("resources")
        .select("id, title, is_hidden, created_at, user_id, profiles(username)")
        .order("created_at", { ascending: false })
        .limit(50);
      setResources(resourcesData || []);

      // Load videos
      const { data: videosData } = await supabase
        .from("videos")
        .select("id, title, is_hidden, created_at, user_id, profiles(username)")
        .order("created_at", { ascending: false })
        .limit(50);
      setVideos(videosData || []);

      // Load verification requests
      const { data: requestsData } = await supabase
        .from("verification_requests")
        .select("*, profiles:user_id(username, avatar_url)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      setVerificationRequests((requestsData as unknown as VerificationRequest[]) || []);
    } catch (error: any) {
      toast({
        title: "Ошибка загрузки",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const PROHUB_BOT_ID = "b7a8e202-40a2-467d-a4de-c416eff4a488";
  const PROTECTED_IDS = [
    PROHUB_BOT_ID,
    "aa75a652-5aaa-4673-a7ca-e693a76eba89", // TwixCore
    "b136038b-10ce-48b5-a278-1d2df8ceddcc", // Kasper
  ];

  const updateUserRole = async (userId: string, newRole: string) => {
    // Protect all protected accounts
    if (PROTECTED_IDS.includes(userId)) {
      toast({
        title: "Запрещено",
        description: "Этот аккаунт защищён от изменения роли",
        variant: "destructive",
      });
      return;
    }

    try {
      // Check if user is protected in DB
      const { data: protectedUser } = await supabase
        .from("protected_users")
        .select("protection_type")
        .eq("user_id", userId)
        .maybeSingle();

      if (protectedUser) {
        toast({
          title: "Запрещено",
          description: "Этот пользователь защищён от изменений роли",
          variant: "destructive",
        });
        return;
      }

      // Remove existing role
      await supabase.from("user_roles").delete().eq("user_id", userId);

      // Add new role
      const { error } = await supabase.from("user_roles").insert({
        user_id: userId,
        role: newRole as any,
        can_moderate_resources: newRole === "moderator" || newRole === "admin",
        can_moderate_topics: newRole === "admin",
      });

      if (error) throw error;

      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast({ title: "Роль обновлена" });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleVerified = async (userId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_verified: !currentValue })
        .eq("id", userId);

      if (error) throw error;

      setUsers(users.map(u => u.id === userId ? { ...u, is_verified: !currentValue } : u));
      toast({ title: currentValue ? "Галочка снята" : "Галочка выдана" });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleContentHidden = async (
    type: "topics" | "resources" | "videos",
    id: string,
    currentValue: boolean
  ) => {
    try {
      const { error } = await supabase
        .from(type)
        .update({ is_hidden: !currentValue })
        .eq("id", id);

      if (error) throw error;

      const setFn = type === "topics" ? setTopics : type === "resources" ? setResources : setVideos;
      const items = type === "topics" ? topics : type === "resources" ? resources : videos;
      setFn(items.map(item => item.id === id ? { ...item, is_hidden: !currentValue } : item));
      
      toast({ title: currentValue ? "Контент показан" : "Контент скрыт" });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteContent = async (type: "topics" | "resources" | "videos", id: string) => {
    try {
      const { error } = await supabase.from(type).delete().eq("id", id);

      if (error) throw error;

      const setFn = type === "topics" ? setTopics : type === "resources" ? setResources : setVideos;
      const items = type === "topics" ? topics : type === "resources" ? resources : videos;
      setFn(items.filter(item => item.id !== id));
      
      toast({ title: "Контент удалён" });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: "bg-red-500",
      moderator: "bg-purple-500",
      editor: "bg-blue-500",
      pro: "bg-green-500",
      newbie: "bg-gray-500",
    };
    return colors[role] || "bg-gray-500";
  };

  const handleApproveRequest = async (requestId: string, userId: string) => {
    try {
      // Update request status
      const { error: requestError } = await supabase
        .from("verification_requests")
        .update({ status: "approved", processed_at: new Date().toISOString(), admin_id: currentUser?.id })
        .eq("id", requestId);

      if (requestError) {
        console.error("Request update error:", requestError);
        throw requestError;
      }

      // Set user as verified
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ is_verified: true })
        .eq("id", userId);

      if (profileError) {
        console.error("Profile update error:", profileError);
        throw profileError;
      }

      setVerificationRequests(prev => prev.filter(r => r.id !== requestId));
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_verified: true } : u));
      
      toast({ title: "Заявка одобрена", description: "Пользователь получил галочку верификации" });
    } catch (error: any) {
      console.error("Approval error:", error);
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!rejectReason.trim()) {
      toast({ title: "Укажите причину отказа", variant: "destructive" });
      return;
    }
    try {
      await supabase
        .from("verification_requests")
        .update({ 
          status: "rejected", 
          reject_reason: rejectReason.trim(),
          processed_at: new Date().toISOString(),
          admin_id: currentUser?.id 
        })
        .eq("id", requestId);

      setVerificationRequests(prev => prev.filter(r => r.id !== requestId));
      setRejectReason("");
      setSelectedRequest(null);
      
      toast({ title: "Заявка отклонена" });
    } catch (error: any) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    }
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (roleLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={currentUser} />
        <main className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Загрузка...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={currentUser} />

      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-7xl">
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-8">
          <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          <h1 className="text-xl sm:text-3xl font-bold">Админ-панель</h1>
        </div>

        <Tabs defaultValue="users" className="space-y-4 sm:space-y-6">
          <TabsList className="flex flex-nowrap gap-1 h-auto overflow-x-auto w-full justify-start scrollbar-thin p-1 max-w-full">
            <TabsTrigger value="users" className="gap-1">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Пользователи</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-1">
              <Flag className="h-4 w-4" />
              <span className="hidden sm:inline">Жалобы</span>
            </TabsTrigger>
            <TabsTrigger value="verification" className="gap-1">
              <BadgeCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Заявки</span>
              {verificationRequests.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {verificationRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="brands" className="gap-1">
              <BadgeCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Бренды</span>
            </TabsTrigger>
            <TabsTrigger value="sections" className="gap-1">
              <FolderOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Разделы</span>
            </TabsTrigger>
            <TabsTrigger value="plugins" className="gap-1">
              <Puzzle className="h-4 w-4" />
              <span className="hidden sm:inline">Плагины</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-1">
              <Layout className="h-4 w-4" />
              <span className="hidden sm:inline">Шаблоны</span>
            </TabsTrigger>
            <TabsTrigger value="topics" className="gap-1">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Темы</span>
            </TabsTrigger>
            <TabsTrigger value="resources" className="gap-1">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Ресурсы</span>
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-1">
              <Video className="h-4 w-4" />
              <span className="hidden sm:inline">Видео</span>
            </TabsTrigger>
            <TabsTrigger value="subforums" className="gap-1">
              <FolderOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Подфорумы</span>
            </TabsTrigger>
            <TabsTrigger value="rename-log" className="gap-1">
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Переименования</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1">
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Аудит</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Настройки</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="h-5 w-5" />
                  Управление пользователями
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск пользователя..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="space-y-4">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex flex-col gap-3 p-3 sm:p-4 border rounded-lg sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="shrink-0">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium truncate">{user.username}</span>
                            {user.is_verified && <VerifiedBadge />}
                            <BannedUserInlineBadge userId={user.id} />
                            <Badge className={getRoleBadgeColor(user.role || "newbie")}>
                              {user.role || "newbie"}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            ID: {user.id.slice(0, 8)}...
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`verified-${user.id}`} className="text-sm">
                            Галочка
                          </Label>
                          <Switch
                            id={`verified-${user.id}`}
                            checked={user.is_verified}
                            onCheckedChange={() => toggleVerified(user.id, user.is_verified)}
                          />
                        </div>

                        <Select
                          value={user.role || "newbie"}
                          onValueChange={(value) => updateUserRole(user.id, value)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="newbie">Новичок</SelectItem>
                            <SelectItem value="pro">Профи</SelectItem>
                            <SelectItem value="editor">Редактор</SelectItem>
                            <SelectItem value="moderator">Модератор</SelectItem>
                            <SelectItem value="admin">Админ</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-4">
            <AdminReportsTab currentUserId={currentUser?.id} />
          </TabsContent>

          {/* Verification Requests Tab */}
          <TabsContent value="verification" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5" />
                  Заявки на верификацию
                </CardTitle>
              </CardHeader>
              <CardContent>
                {verificationRequests.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Нет заявок на рассмотрение</p>
                ) : (
                  <div className="space-y-4">
                    {verificationRequests.map((request) => (
                      <div
                        key={request.id}
                        className="p-4 border rounded-lg space-y-3"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={request.profiles?.avatar_url || undefined} />
                            <AvatarFallback>
                              {request.profiles?.username?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{request.profiles?.username}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(request.created_at).toLocaleDateString("ru-RU")}
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-muted p-3 rounded text-sm">
                          <p className="font-medium mb-1">Причина заявки:</p>
                          <p>{request.reason}</p>
                        </div>

                        {selectedRequest === request.id ? (
                          <div className="space-y-2">
                            <Textarea
                              placeholder="Причина отказа..."
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRejectRequest(request.id)}
                              >
                                Подтвердить отказ
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setSelectedRequest(null); setRejectReason(""); }}
                              >
                                Отмена
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApproveRequest(request.id, request.user_id)}
                            >
                              Одобрить
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedRequest(request.id)}
                            >
                              Отклонить
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="topics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Управление темами</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topics.map((topic) => (
                    <div
                      key={topic.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border rounded-lg"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{topic.title}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
                          от {topic.profiles?.username || "Неизвестно"}
                          <BannedUserInlineBadge userId={topic.user_id} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {topic.is_pinned && <Badge variant="secondary" className="gap-1"><Pin className="h-3 w-3" />Закреп</Badge>}
                        {topic.is_locked && <Badge variant="secondary" className="gap-1"><LockIcon className="h-3 w-3" />Закрыта</Badge>}
                        <Badge variant={topic.is_hidden ? "destructive" : "default"}>
                          {topic.is_hidden ? "Скрыта" : "Активна"}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleContentHidden("topics", topic.id, topic.is_hidden)}
                        >
                          {topic.is_hidden ? "Показать" : "Скрыть"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resources" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Управление ресурсами</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {resources.map((resource) => (
                    <div
                      key={resource.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border rounded-lg"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{resource.title}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
                          от {resource.profiles?.username || "Неизвестно"}
                          <BannedUserInlineBadge userId={resource.user_id} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={resource.is_hidden ? "destructive" : "default"}>
                          {resource.is_hidden ? "Скрыт" : "Активен"}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleContentHidden("resources", resource.id, resource.is_hidden)}
                        >
                          {resource.is_hidden ? "Показать" : "Скрыть"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="videos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Управление видео</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {videos.length === 0 ? (
                    <p className="text-muted-foreground">Видео не найдены</p>
                  ) : (
                    videos.map((video) => (
                      <div
                        key={video.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border rounded-lg"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{video.title}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
                            от {video.profiles?.username || "Неизвестно"}
                            <BannedUserInlineBadge userId={video.user_id} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={video.is_hidden ? "destructive" : "default"}>
                            {video.is_hidden ? "Скрыто" : "Активно"}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleContentHidden("videos", video.id, video.is_hidden)}
                          >
                            {video.is_hidden ? "Показать" : "Скрыть"}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sections" className="space-y-4">
            <AdminSectionsTab />
          </TabsContent>

          <TabsContent value="plugins" className="space-y-4">
            <AdminPluginsTab />
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <AdminTemplatesTab />
          </TabsContent>

          <TabsContent value="subforums" className="space-y-4">
            <AdminSubForumsTab />
          </TabsContent>

          <TabsContent value="rename-log" className="space-y-4">
            <AdminInactiveRenameTab />
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <AdminAuditLogTab />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <AdminSettingsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPanel;

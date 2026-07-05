import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Users, ArrowUpDown, Trophy, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import VerifiedBadge from "@/components/VerifiedBadge";
import ReputationDisplay from "@/components/ReputationDisplay";
import UserLevelBadge from "@/components/UserLevelBadge";
import BannedUserInlineBadge from "@/components/BannedUserInlineBadge";
import StyledUsername from "@/components/StyledUsername";

interface MemberInfo {
  id: string;
  username: string;
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
  role: string;
  reputation_points: number;
  posts_count: number;
  topics_count: number;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  moderator: "Модератор",
  editor: "Редактор",
  pro: "Профи",
  newbie: "Новичок",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive text-destructive-foreground",
  moderator: "bg-purple-500 text-white",
  editor: "bg-blue-500 text-white",
  pro: "bg-green-500 text-white",
  newbie: "bg-muted text-muted-foreground",
};

type SortBy = "reputation" | "posts" | "date" | "username";

const Members = () => {
  const [user, setUser] = useState<any>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortBy>("reputation");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, is_verified, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Load roles & reputation in parallel
      const membersWithData = await Promise.all(
        (profiles || []).map(async (p) => {
          const [roleResult, repResult, postsResult, topicsResult] = await Promise.all([
            supabase.rpc("get_user_role", { _user_id: p.id }),
            supabase.from("user_reputation").select("reputation_points").eq("user_id", p.id).maybeSingle(),
            supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", p.id),
            supabase.from("topics").select("*", { count: "exact", head: true }).eq("user_id", p.id),
          ]);

          return {
            ...p,
            role: roleResult.data || "newbie",
            reputation_points: repResult.data?.reputation_points || 0,
            posts_count: postsResult.count || 0,
            topics_count: topicsResult.count || 0,
          };
        })
      );

      setMembers(membersWithData);
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

  const filteredAndSorted = useMemo(() => {
    let result = members.filter((m) => {
      const matchesSearch = m.username.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === "all" || m.role === roleFilter;
      return matchesSearch && matchesRole;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "reputation":
          cmp = a.reputation_points - b.reputation_points;
          break;
        case "posts":
          cmp = (a.posts_count + a.topics_count) - (b.posts_count + b.topics_count);
          break;
        case "date":
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "username":
          cmp = a.username.localeCompare(b.username);
          break;
      }
      return sortOrder === "desc" ? -cmp : cmp;
    });

    return result;
  }, [members, searchTerm, roleFilter, sortBy, sortOrder]);

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="flex items-center gap-3 mb-6">
          <Users className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Участники</h1>
            <p className="text-sm text-muted-foreground">{members.length} зарегистрировано</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по имени..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Роль" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все роли</SelectItem>
                  <SelectItem value="admin">Администратор</SelectItem>
                  <SelectItem value="moderator">Модератор</SelectItem>
                  <SelectItem value="editor">Редактор</SelectItem>
                  <SelectItem value="pro">Профи</SelectItem>
                  <SelectItem value="newbie">Новичок</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Сортировка" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reputation">По репутации</SelectItem>
                  <SelectItem value="posts">По постам</SelectItem>
                  <SelectItem value="date">По дате</SelectItem>
                  <SelectItem value="username">По имени</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                title={sortOrder === "desc" ? "По убыванию" : "По возрастанию"}
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Members List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
        ) : filteredAndSorted.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Участники не найдены
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAndSorted.map((member) => (
              <Link key={member.id} to={`/profile/${member.username}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 flex-shrink-0">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {member.username[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StyledUsername username={member.username} userId={member.id} isVerified={member.is_verified} disableMiniProfile className="font-semibold truncate" />
                          <BannedUserInlineBadge userId={member.id} />
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge className={ROLE_COLORS[member.role] || ROLE_COLORS.newbie}>
                            {ROLE_LABELS[member.role] || member.role}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500" />
                            {member.reputation_points}
                          </span>
                          <span>{member.posts_count + member.topics_count} постов</span>
                        </div>
                        <div className="mt-1.5">
                          <UserLevelBadge postCount={member.posts_count + member.topics_count} reputation={member.reputation_points} compact />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Members;

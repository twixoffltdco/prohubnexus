import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import UserLink from "@/components/UserLink";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Pin, Lock, Send, Eye, Flag } from "lucide-react";
import { useInterestTracking } from "@/hooks/useInterestTracking";
import { LikeButton } from "@/components/LikeButton";
import TopicWatchButton from "@/components/TopicWatchButton";
import UserSignature from "@/components/UserSignature";
import ReportDialog from "@/components/ReportDialog";
import QuoteButton from "@/components/QuoteButton";
import BBCodeRenderer from "@/components/BBCodeRenderer";
import BBCodeToolbar from "@/components/BBCodeToolbar";
import PostBookmarkButton from "@/components/PostBookmarkButton";
import ShareButton from "@/components/ShareButton";
import ReadingProgress from "@/components/ReadingProgress";
import { use2FAGuard } from "@/hooks/use2FAGuard";
import { useActiveBrand } from "@/hooks/useActiveBrand";
import BannedUserBadge from "@/components/BannedUserBadge";
import BannedUserInlineBadge from "@/components/BannedUserInlineBadge";
import HiddenContentBanner from "@/components/HiddenContentBanner";
import SeasonalCountdown from "@/components/SeasonalCountdown";
import ModerationActionDialog from "@/components/ModerationActionDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { PinOff, Unlock, EyeOff } from "lucide-react";

interface Post {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  author_brand_id?: string | null;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
  brand_accounts?: {
    name: string;
    handle: string;
    avatar_url: string | null;
    is_verified: boolean;
  } | null;
}

const TopicView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [topic, setTopic] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const { toast } = useToast();
  const { trackInterest } = useInterestTracking(user?.id);
  const { check2FA } = use2FAGuard();
  const { activeBrandId } = useActiveBrand();
  const { isAdmin, isModerator, canModerateTopics } = useUserRole();
  const canMod = isAdmin || (isModerator && canModerateTopics);

  const [hideOpen, setHideOpen] = useState(false);

  const callModAction = async (action: string, reason?: string) => {
    if (!canMod || !topic?.id) return;
    const { error } = await supabase.rpc("moderate_topic" as any, { _scope: "prohub", _topic_id: topic.id, _action: action, _reason: reason || null });
    if (error) { toast({ title: "Ошибка", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Готово" });
    loadTopicAndPosts();
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadTopicAndPosts();
    incrementViews();
    if (!id) return;
    const ch = supabase.channel(`ph-topic-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts", filter: `topic_id=eq.${id}` }, () => loadTopicAndPosts())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "topics", filter: `id=eq.${id}` }, () => loadTopicAndPosts())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  useEffect(() => {
    if (topic?.categories?.slug) {
      trackInterest(topic.categories.slug);
    }
  }, [topic]);

  const handleQuote = useCallback((quotedText: string) => {
    setNewPost((prev) => quotedText + prev);
    // Scroll to reply area
    document.getElementById("reply-form")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const incrementViews = async () => {
    if (!id) return;
    let key = localStorage.getItem("ph_viewer_key");
    if (!key) { key = crypto.randomUUID(); localStorage.setItem("ph_viewer_key", key); }
    await supabase.rpc("increment_topic_views" as any, { _scope: "prohub", _topic_id: id, _viewer_key: user?.id || key });
  };

  const loadTopicAndPosts = async () => {
    try {
      const { data: topicData, error: topicError } = await supabase
        .from("topics")
        .select(`
          *,
          profiles (
            username,
            avatar_url
          ),
          categories (
            name,
            slug,
            forum_id
          )
        `)
        .eq("id", id)
        .single();

      if (topicError) throw topicError;

      if (topicData.categories?.forum_id === "codeforum") {
        navigate(`/codeforum/topic/${id}`, { replace: true });
        return;
      }

      setTopic(topicData);

      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select(`
          *,
          profiles (
            username,
            avatar_url
          ),
          brand_accounts:author_brand_id (
            name,
            handle,
            avatar_url,
            is_verified
          )
        `)
        .eq("topic_id", id)
        .eq("is_hidden", false)
        .order("created_at", { ascending: true });

      if (postsError) throw postsError;
      setPosts(postsData || []);
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

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !newPost.trim()) {
      toast({
        title: "Войдите в систему",
        description: "Для отправки сообщений нужно войти в систему",
        variant: "destructive",
      });
      return;
    }

    setPosting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: moderationResult, error: moderationError } = await supabase.functions.invoke(
        'moderate-content',
        {
          body: { content: newPost, type: 'post' },
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );

      if (moderationError) throw moderationError;

      if (!moderationResult.approved) {
        toast({
          title: "Неприемлемый контент",
          description: moderationResult.reason || "Контент не прошёл модерацию",
          variant: "destructive",
        });
        setPosting(false);
        return;
      }

      const { error } = await supabase.from("posts").insert({
        topic_id: id,
        user_id: user.id,
        content: newPost.trim(),
        author_brand_id: activeBrandId || null,
      });

      if (error) throw error;

      // Auto-update quest progress for posts
      await supabase.rpc("increment_quest_progress", {
        _user_id: user.id,
        _action_type: "posts",
      });

      await supabase.rpc("check_and_award_achievements", {
        _user_id: user.id,
      });

      setNewPost("");
      loadTopicAndPosts();
      
      await supabase.rpc('check_and_upgrade_role', { _user_id: user.id });
      
      toast({
        title: "Сообщение отправлено",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка отправки",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} />
        <div className="container mx-auto px-4 py-8 text-center">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ReadingProgress />
      <Header user={user} />

      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <SeasonalCountdown />
        <div className="mb-4">
          <Button variant="ghost" onClick={() => navigate(`/category/${topic?.categories?.slug}`)}>
            ← Вернуться в {topic?.categories?.name}
          </Button>
        </div>

        {/* Topic Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {topic?.profiles?.username?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {topic?.is_pinned && <Pin className="h-4 w-4 text-primary flex-shrink-0" />}
                  {topic?.is_locked && <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                  <h1 className="text-xl sm:text-3xl font-bold break-words">{topic?.title}</h1>
                </div>
                <p className="text-sm text-muted-foreground mb-4 flex items-center gap-2 flex-wrap">
                  от <UserLink username={topic?.profiles?.username} showAvatar={false} /> •{" "}
                  {formatDistanceToNow(new Date(topic?.created_at), {
                    addSuffix: true,
                    locale: ru,
                  })}
                </p>
                <div className="prose prose-sm max-w-none">
                  <BBCodeRenderer content={topic?.content || ""} />
                </div>
                <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t flex-wrap">
                  <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                    <LikeButton 
                      contentType="topic" 
                      contentId={topic?.id} 
                      authorId={topic?.user_id} 
                    />
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      {topic?.views}
                    </span>
                    <ShareButton title={topic?.title || ""} />
                    {user && topic?.profiles?.username && (
                      <QuoteButton
                        username={topic.profiles.username}
                        content={topic.content}
                        onQuote={handleQuote}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {user && topic?.user_id !== user.id && (
                      <ReportDialog 
                        contentType="topic" 
                        contentId={topic?.id} 
                        contentAuthorId={topic?.user_id}
                      />
                    )}
                    <TopicWatchButton topicId={topic?.id} userId={user?.id} />
                  </div>
                </div>
                {topic?.is_hidden && <HiddenContentBanner reason={topic.hidden_reason} className="mt-3" />}
                {canMod && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => callModAction(topic.is_pinned ? "unpin" : "pin")}>
                      {topic.is_pinned ? <PinOff className="h-3 w-3 mr-1" /> : <Pin className="h-3 w-3 mr-1" />}
                      {topic.is_pinned ? "Открепить" : "Закрепить"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => callModAction(topic.is_locked ? "unlock" : "lock")}>
                      {topic.is_locked ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                      {topic.is_locked ? "Открыть" : "Закрыть"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => topic.is_hidden ? callModAction("show") : setHideOpen(true)}>
                      {topic.is_hidden ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                      {topic.is_hidden ? "Показать" : "Скрыть"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Posts */}
        <div className="space-y-4 mb-6">
          {posts.map((post) => {
            const brand = post.brand_accounts;
            const displayName = brand?.name || post.profiles?.username;
            const displayAvatar = brand?.avatar_url || post.profiles?.avatar_url;
            const brandHandle = brand?.handle;
            return (
            <Card key={post.id}>
              <CardContent className="pt-4 sm:pt-6">
                {!brand && <BannedUserBadge userId={post.user_id} className="mb-3" />}
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                    {displayAvatar && <AvatarImage src={displayAvatar} />}
                    <AvatarFallback className="bg-secondary text-xs sm:text-sm">
                      {displayName?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {brand ? (
                        <>
                          <a href={`/brand/${brandHandle}`} className="font-semibold hover:underline text-primary">
                            {brand.name}
                          </a>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wide">Бренд</span>
                          {brand.is_verified && <span className="text-[10px] text-primary">✓</span>}
                          <span className="text-xs text-muted-foreground">от @{post.profiles?.username}</span>
                        </>
                      ) : (
                        <>
                          <UserLink username={post.profiles?.username} avatarUrl={post.profiles?.avatar_url} />
                          <BannedUserInlineBadge userId={post.user_id} />
                        </>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ru })}
                      </span>
                    </div>
                    <BBCodeRenderer content={post.content} />
                    <div className="mt-2 flex items-center gap-1 sm:gap-2 flex-wrap">
                      <LikeButton 
                        contentType="post" 
                        contentId={post.id} 
                        authorId={post.user_id}
                        size="sm"
                      />
                      {user && (
                        <QuoteButton
                          username={post.profiles?.username}
                          content={post.content}
                          onQuote={handleQuote}
                        />
                      )}
                      <PostBookmarkButton
                        postId={post.id}
                        postContent={post.content}
                        topicTitle={topic?.title}
                        topicId={topic?.id}
                      />
                      {user && post.user_id !== user.id && (
                        <ReportDialog 
                          contentType="post" 
                          contentId={post.id} 
                          contentAuthorId={post.user_id}
                        />
                      )}
                    </div>
                    {!brand && <UserSignature userId={post.user_id} />}
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>

        {/* Reply Form */}
        {user && !topic?.is_locked && (
          <Card id="reply-form">
            <CardContent className="pt-6">
              <form onSubmit={handlePostSubmit} className="space-y-4">
                <div className="space-y-0">
                  <BBCodeToolbar
                    onInsert={(before, after) => {
                      const textarea = document.getElementById("reply-textarea") as HTMLTextAreaElement;
                      if (!textarea) return;
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const selected = newPost.substring(start, end);
                      const newContent = newPost.substring(0, start) + before + selected + after + newPost.substring(end);
                      setNewPost(newContent);
                      setTimeout(() => {
                        textarea.focus();
                        textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
                      }, 0);
                    }}
                  />
                  <Textarea
                    id="reply-textarea"
                    placeholder="Написать ответ... Используйте BBCode для форматирования"
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    rows={4}
                    className="min-h-[100px] rounded-t-none"
                    required
                  />
                </div>
                {activeBrandId && (
                  <p className="text-xs text-muted-foreground">
                    Вы отвечаете от лица активного бренд-аккаунта. Переключите бренд в шапке, чтобы писать от себя.
                  </p>
                )}
                <Button type="submit" disabled={posting}>
                  <Send className="mr-2 h-4 w-4" />
                  {posting ? "Отправка..." : activeBrandId ? "Ответить от бренда" : "Ответить"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {!user && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">
                Войдите, чтобы оставить комментарий
              </p>
              <Button onClick={() => navigate("/auth")}>Войти</Button>
            </CardContent>
          </Card>
        )}
      </main>
      <ModerationActionDialog
        open={hideOpen}
        onOpenChange={setHideOpen}
        title="Скрыть тему"
        requireReason
        onConfirm={(reason) => callModAction("hide", reason)}
      />
    </div>
  );
};

export default TopicView;

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { usd, dateTime } from "@/lib/format";
import { BADGE_METRICS, CHALLENGE_METRICS } from "@/lib/engagement";

export const Route = createFileRoute("/_authenticated/admin/engagement")({
  head: () => ({
    meta: [
      { title: "Engagement & Rewards — Zurify Admin" },
      { name: "description", content: "Configure streaks, lucky windows, mystery boxes, challenges, badges, reputation and Zurify Pro." },
    ],
  }),
  component: AdminEngagement,
});

type Row = Record<string, unknown>;

type Challenge = {
  id: string; name: string; description: string; metric: string; target: number;
  reward_cents: number; starts_at: string; ends_at: string; active: boolean;
  require_kyc: boolean; min_approved_jobs: number;
};
type BadgeRow = {
  id: string; slug: string; name: string; description: string; icon: string;
  metric: string; threshold: number; reward_cents: number; visible: boolean; active: boolean; sort_order: number;
};

const numArr = (v: unknown) => ((v as number[] | null) ?? []).join(", ");
const parseArr = (v: string) => v.split(",").map(x => parseInt(x.trim(), 10)).filter(n => Number.isFinite(n));

function AdminEngagement() {
  const [s, setS] = useState<Row | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [a, b, c] = await Promise.all([
      supabase.from("engagement_settings").select("*").eq("singleton", true).maybeSingle(),
      supabase.from("challenges").select("*").order("ends_at", { ascending: false }),
      supabase.from("badges").select("*").order("sort_order"),
    ]);
    setS((a.data ?? null) as Row | null);
    setChallenges((b.data ?? []) as unknown as Challenge[]);
    setBadges((c.data ?? []) as unknown as BadgeRow[]);
  }
  useEffect(() => { void load(); }, []);

  const set = (k: string, v: unknown) => setS(prev => (prev ? { ...prev, [k]: v } : prev));
  const num = (k: string) => Number(s?.[k] ?? 0);
  const str = (k: string) => String(s?.[k] ?? "");
  const bool = (k: string) => Boolean(s?.[k]);

  async function save() {
    if (!s) return;
    setSaving(true);
    const { id, created_at, updated_at, ...payload } = s as Record<string, unknown>;
    void id; void created_at; void updated_at;
    const { error } = await supabase.from("engagement_settings").update(payload as never).eq("singleton", true);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Engagement settings saved");
  }

  async function addChallenge() {
    const { error } = await supabase.from("challenges").insert({
      name: "New challenge", description: "Describe the goal", metric: "approved_jobs",
      target: 5, reward_cents: 50,
    } as never);
    if (error) return toast.error(error.message);
    void load();
  }
  async function saveChallenge(c: Challenge) {
    const { id, ...rest } = c;
    const { error } = await supabase.from("challenges").update(rest as never).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Challenge saved");
  }
  async function delChallenge(id: string) {
    const { error } = await supabase.from("challenges").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  }

  async function addBadge() {
    const slug = `badge-${Date.now()}`;
    const { error } = await supabase.from("badges").insert({
      slug, name: "New badge", description: "", metric: "approved_jobs", threshold: 1,
      sort_order: badges.length + 1,
    } as never);
    if (error) return toast.error(error.message);
    void load();
  }
  async function saveBadge(b: BadgeRow) {
    const { id, ...rest } = b;
    const { error } = await supabase.from("badges").update(rest as never).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Badge saved");
  }
  async function delBadge(id: string) {
    const { error } = await supabase.from("badges").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  }

  if (!s) {
    return <AdminShell title="Engagement & Rewards"><Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card></AdminShell>;
  }

  const numField = (k: string, label: string, hint?: string) => (
    <div>
      <Label>{label}</Label>
      <Input type="number" value={num(k)} onChange={e => set(k, Number(e.target.value))} />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  const toggle = (k: string, label: string, hint?: string) => (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div><p className="text-sm font-medium">{label}</p>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
      <Switch checked={bool(k)} onCheckedChange={v => set(k, v)} />
    </div>
  );

  return (
    <AdminShell title="Engagement & Rewards" subtitle="Every reward system on Zurify is configured here — nothing is hardcoded.">
      <div className="mb-4 flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
      </div>

      <Tabs defaultValue="streak">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="streak">Daily streak</TabsTrigger>
          <TabsTrigger value="lucky">Lucky window</TabsTrigger>
          <TabsTrigger value="mystery">Mystery box</TabsTrigger>
          <TabsTrigger value="challenges">Challenges</TabsTrigger>
          <TabsTrigger value="badges">Badges</TabsTrigger>
          <TabsTrigger value="reputation">Reputation</TabsTrigger>
          <TabsTrigger value="pro">Zurify Pro</TabsTrigger>
        </TabsList>

        <TabsContent value="streak">
          <Card><CardContent className="space-y-4 p-6">
            {toggle("streak_enabled", "Daily streak enabled")}
            <div>
              <Label>Stage 1 — days 1 to 7 rewards (cents, comma separated)</Label>
              <Input value={numArr(s["streak_stage1_rewards"])} onChange={e => set("streak_stage1_rewards", parseArr(e.target.value))} />
              <p className="mt-1 text-xs text-muted-foreground">Members only need to log in and claim.</p>
            </div>
            <div>
              <Label>Stage 2 — days 8 to 14 rewards (cents)</Label>
              <Input value={numArr(s["streak_stage2_rewards"])} onChange={e => set("streak_stage2_rewards", parseArr(e.target.value))} />
            </div>
            {numField("streak_stage2_required_jobs", "Stage 2 required approved jobs (last 7 days)")}
            <div>
              <Label>Stage 3 — days 15 to 30 rewards (cents, 16 values)</Label>
              <Input value={numArr(s["streak_stage3_rewards"])} onChange={e => set("streak_stage3_rewards", parseArr(e.target.value))} />
            </div>
            {numField("streak_stage3_required_jobs", "Stage 3 required approved jobs (last 7 days)")}
            <div className="grid gap-4 sm:grid-cols-2">
              {numField("streak_max_reward_cents", "Maximum daily reward (cents)")}
              {numField("streak_grace_days", "Grace period in days", "0 means missing a day resets the streak.")}
            </div>
            <div>
              <Label>After day 30</Label>
              <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={str("streak_after_30")} onChange={e => set("streak_after_30", e.target.value)}>
                <option value="loop">Loop back to day 1</option>
                <option value="repeat">Continue repeating the day 30 reward</option>
              </select>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="lucky">
          <Card><CardContent className="space-y-4 p-6">
            {toggle("lucky_enabled", "Lucky reward window enabled")}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Opening time (UTC)</Label>
                <Input type="time" value={str("lucky_open_time").slice(0, 5)} onChange={e => set("lucky_open_time", `${e.target.value}:00`)} />
              </div>
              {numField("lucky_duration_minutes", "Window duration (minutes)")}
              {numField("lucky_reward_cents", "Reward amount (cents)")}
              {numField("lucky_max_winners", "Maximum winners per day")}
              {numField("lucky_cooldown_days", "Cooldown between claims (days)")}
              {numField("lucky_min_approved_jobs", "Minimum approved jobs to be eligible")}
            </div>
            {toggle("lucky_require_kyc", "Require identity verification")}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="mystery">
          <Card><CardContent className="space-y-4 p-6">
            {toggle("mystery_enabled", "Mystery box enabled")}
            <div className="grid gap-4 sm:grid-cols-2">
              {numField("mystery_frequency_days", "One box every N days")}
              {numField("mystery_min_approved_jobs", "Minimum approved jobs to be eligible")}
            </div>
            {toggle("mystery_require_kyc", "Require identity verification")}
            <div>
              <Label>Prize table (JSON: label, weight, min_cents, max_cents)</Label>
              <Textarea rows={10} className="font-mono text-xs"
                value={JSON.stringify(s["mystery_outcomes"], null, 2)}
                onChange={e => { try { set("mystery_outcomes", JSON.parse(e.target.value)); } catch { /* keep typing */ } }} />
              <p className="mt-1 text-xs text-muted-foreground">Weights are relative — a weight of 40 out of a total of 100 gives a 40% chance.</p>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="challenges">
          <Card><CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              {toggle("challenges_enabled", "Weekly challenges enabled")}
            </div>
            {toggle("challenges_require_kyc", "Require identity verification for all challenges")}
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={addChallenge}><Plus className="mr-1 h-4 w-4" /> New challenge</Button>
            </div>
            {challenges.length === 0 && <p className="text-sm text-muted-foreground">No challenges yet.</p>}
            {challenges.map((c, i) => {
              const upd = (patch: Partial<Challenge>) =>
                setChallenges(list => list.map((x, j) => (i === j ? { ...x, ...patch } : x)));
              return (
                <div key={c.id} className="space-y-3 rounded-lg border border-border p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>Name</Label><Input value={c.name} onChange={e => upd({ name: e.target.value })} /></div>
                    <div>
                      <Label>Goal metric</Label>
                      <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={c.metric} onChange={e => upd({ metric: e.target.value })}>
                        {CHALLENGE_METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div><Label>Description</Label><Input value={c.description} onChange={e => upd({ description: e.target.value })} /></div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div><Label>Target</Label><Input type="number" value={c.target} onChange={e => upd({ target: Number(e.target.value) })} /></div>
                    <div><Label>Reward (cents)</Label><Input type="number" value={c.reward_cents} onChange={e => upd({ reward_cents: Number(e.target.value) })} /></div>
                    <div><Label>Starts</Label><Input type="datetime-local" value={c.starts_at.slice(0, 16)} onChange={e => upd({ starts_at: new Date(e.target.value).toISOString() })} /></div>
                    <div><Label>Ends</Label><Input type="datetime-local" value={c.ends_at.slice(0, 16)} onChange={e => upd({ ends_at: new Date(e.target.value).toISOString() })} /></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div><Label>Min approved jobs</Label><Input type="number" value={c.min_approved_jobs} onChange={e => upd({ min_approved_jobs: Number(e.target.value) })} /></div>
                    <label className="flex items-center gap-2 pt-6 text-sm"><Switch checked={c.require_kyc} onCheckedChange={v => upd({ require_kyc: v })} /> Require verification</label>
                    <label className="flex items-center gap-2 pt-6 text-sm"><Switch checked={c.active} onCheckedChange={v => upd({ active: v })} /> Active</label>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{usd(c.reward_cents)} reward</Badge>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => delChallenge(c.id)}><Trash2 className="h-4 w-4" /></Button>
                      <Button size="sm" onClick={() => saveChallenge(c)}>Save</Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="badges">
          <Card><CardContent className="space-y-4 p-6">
            {toggle("badges_enabled", "Achievement badges enabled")}
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={addBadge}><Plus className="mr-1 h-4 w-4" /> New badge</Button>
            </div>
            {badges.map((b, i) => {
              const upd = (patch: Partial<BadgeRow>) => setBadges(list => list.map((x, j) => (i === j ? { ...x, ...patch } : x)));
              return (
                <div key={b.id} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-6">
                  <div className="sm:col-span-2"><Label>Name</Label><Input value={b.name} onChange={e => upd({ name: e.target.value })} /></div>
                  <div className="sm:col-span-2">
                    <Label>Requirement</Label>
                    <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={b.metric} onChange={e => upd({ metric: e.target.value })}>
                      {BADGE_METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div><Label>Threshold</Label><Input type="number" value={b.threshold} onChange={e => upd({ threshold: Number(e.target.value) })} /></div>
                  <div><Label>Reward (cents)</Label><Input type="number" value={b.reward_cents} onChange={e => upd({ reward_cents: Number(e.target.value) })} /></div>
                  <div className="sm:col-span-4"><Label>Description</Label><Input value={b.description} onChange={e => upd({ description: e.target.value })} /></div>
                  <label className="flex items-center gap-2 pt-6 text-sm"><Switch checked={b.visible} onCheckedChange={v => upd({ visible: v })} /> Visible</label>
                  <label className="flex items-center gap-2 pt-6 text-sm"><Switch checked={b.active} onCheckedChange={v => upd({ active: v })} /> Active</label>
                  <div className="flex justify-end gap-2 sm:col-span-6">
                    <Button size="sm" variant="ghost" onClick={() => delBadge(b.id)}><Trash2 className="h-4 w-4" /></Button>
                    <Button size="sm" onClick={() => saveBadge(b)}>Save</Button>
                  </div>
                </div>
              );
            })}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="reputation">
          <Card><CardContent className="space-y-4 p-6">
            <p className="text-sm text-muted-foreground">
              Trust score is a weighted 1–100 value. Weights are relative to each other.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {numField("rep_w_approval_rate", "Weight — approval rate")}
              {numField("rep_w_approved_jobs", "Weight — approved jobs")}
              {numField("rep_w_completed_jobs", "Weight — completed jobs")}
              {numField("rep_w_kyc", "Weight — identity verified")}
              {numField("rep_w_account_age", "Weight — account age")}
              {numField("rep_w_withdrawals", "Weight — successful withdrawals")}
              {numField("rep_w_clean_record", "Weight — no suspensions or holds")}
              {numField("rep_w_recent_activity", "Weight — recent activity")}
            </div>
            <div>
              <Label>Star thresholds</Label>
              <Textarea rows={10} className="font-mono text-xs"
                value={JSON.stringify(s["rep_star_thresholds"], null, 2)}
                onChange={e => { try { set("rep_star_thresholds", JSON.parse(e.target.value)); } catch { /* keep typing */ } }} />
              <p className="mt-1 text-xs text-muted-foreground">
                Each entry: stars, min_approved, min_rate, min_score, require_kyc, require_clean, label.
              </p>
            </div>
            <div><Label>1-star label</Label><Input value={str("rep_star1_label")} onChange={e => set("rep_star1_label", e.target.value)} /></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="pro">
          <Card><CardContent className="space-y-4 p-6">
            {toggle("pro_enabled", "Zurify Pro visible to members")}
            <div className="grid gap-4 sm:grid-cols-2">
              {numField("pro_price_cents", "Price (cents)")}
              {numField("pro_duration_days", "Duration (days)")}
            </div>
            <div>
              <Label>Benefits (one per line)</Label>
              <Textarea rows={7} value={((s["pro_benefits"] as string[] | null) ?? []).join("\n")}
                onChange={e => set("pro_benefits", e.target.value.split("\n").filter(Boolean))} />
            </div>
            <div><Label>Payment instructions</Label><Textarea rows={3} value={str("pro_payment_instructions")} onChange={e => set("pro_payment_instructions", e.target.value)} /></div>
            <div><Label>FAQ</Label><Textarea rows={4} value={str("pro_faq")} onChange={e => set("pro_faq", e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">Membership requests are reviewed on the Zurify Pro page. Last updated {dateTime(String(s["updated_at"] ?? ""))}.</p>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
      </div>
    </AdminShell>
  );
}

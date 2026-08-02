import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search, Plus, Pencil, Archive, Power, PowerOff, Eye, Trophy, RefreshCw, ArrowUpDown,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { shortDate, usd } from "@/lib/format";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/campaigns")({
  head: () => ({
    meta: [
      { title: "Referral Campaigns — Zurify Admin" },
      { name: "description", content: "Organise Zurify referral campaigns, prizes and partner performance in one place." },
    ],
  }),
  component: AdminCampaigns,
});

type Campaign = {
  id: string; name: string; description: string | null;
  starts_at: string; ends_at: string; prize: string; winner_count: number;
  eligibility: string; status: string; created_at: string;
};

type CodeRow = {
  id: string; code: string; owner_full_name: string | null; status: string;
  users_referred: number; awarded_bonus_users: number; pending_bonus_users: number;
  total_bonus_cents: number; total_commission_cents: number;
  campaign_name: string | null; leaderboard_eligible: boolean;
};

type Stats = {
  codes: number; activeCodes: number; referrals: number; successful: number;
  bonus: number; commission: number; leaderboard: number;
};

const emptyStats: Stats = { codes: 0, activeCodes: 0, referrals: 0, successful: 0, bonus: 0, commission: 0, leaderboard: 0 };

function statsFor(name: string, codes: CodeRow[]): Stats {
  const mine = codes.filter(c => (c.campaign_name ?? "").toLowerCase() === name.toLowerCase());
  return mine.reduce<Stats>((a, c) => ({
    codes: a.codes + 1,
    activeCodes: a.activeCodes + (c.status === "active" ? 1 : 0),
    referrals: a.referrals + Number(c.users_referred),
    successful: a.successful + Number(c.awarded_bonus_users),
    bonus: a.bonus + Number(c.total_bonus_cents),
    commission: a.commission + Number(c.total_commission_cents),
    leaderboard: a.leaderboard + (c.leaderboard_eligible ? 1 : 0),
  }), { ...emptyStats });
}

const statusVariant = (s: string) => (s === "active" ? "default" : s === "archived" ? "outline" : "secondary");

function AdminCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("newest");
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    const [c, r] = await Promise.all([
      supabase.from("referral_campaigns").select("*").order("created_at", { ascending: false }),
      supabase.rpc("admin_list_referral_codes" as never),
    ]);
    if (c.error) setError(c.error.message);
    setCampaigns((c.data ?? []) as unknown as Campaign[]);
    setCodes(((r.data ?? []) as unknown) as CodeRow[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const list = campaigns
      .map(c => ({ c, s: statsFor(c.name, codes) }))
      .filter(({ c }) => statusFilter === "all" || c.status === statusFilter)
      .filter(({ c }) => {
        if (!q) return true;
        const s = q.toLowerCase();
        return c.name.toLowerCase().includes(s) || (c.description ?? "").toLowerCase().includes(s) || c.prize.toLowerCase().includes(s);
      });
    const sorters: Record<string, (a: typeof list[number], b: typeof list[number]) => number> = {
      newest: (a, b) => +new Date(b.c.created_at) - +new Date(a.c.created_at),
      name: (a, b) => a.c.name.localeCompare(b.c.name),
      ending: (a, b) => +new Date(a.c.ends_at) - +new Date(b.c.ends_at),
      referrals: (a, b) => b.s.referrals - a.s.referrals,
      commission: (a, b) => b.s.commission - a.s.commission,
    };
    return [...list].sort(sorters[sortKey] ?? sorters.newest);
  }, [campaigns, codes, q, statusFilter, sortKey]);

  async function setStatus(id: string, status: string) {
    const { error: e } = await supabase.from("referral_campaigns").update({ status }).eq("id", id);
    if (e) return toast.error(e.message);
    toast.success(`Campaign ${status}`);
    load();
  }

  const totals = rows.reduce((a, { s }) => ({
    referrals: a.referrals + s.referrals,
    successful: a.successful + s.successful,
    bonus: a.bonus + s.bonus,
    commission: a.commission + s.commission,
  }), { referrals: 0, successful: 0, bonus: 0, commission: 0 });

  return (
    <AdminShell title="Referral Campaigns" subtitle="Group referral codes into campaigns and track partner performance.">
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Campaigns", value: campaigns.length },
          { label: "Active", value: campaigns.filter(c => c.status === "active").length },
          { label: "Total referrals", value: totals.referrals },
          { label: "Bonuses paid", value: usd(totals.bonus) },
          { label: "Commissions paid", value: usd(totals.commission) },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-xl font-semibold">{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search campaigns" className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={setSortKey}>
          <SelectTrigger className="w-[170px]"><ArrowUpDown className="mr-2 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="ending">Ending soonest</SelectItem>
            <SelectItem value="referrals">Most referrals</SelectItem>
            <SelectItem value="commission">Most commission</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" title="Refresh" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Create campaign</Button></DialogTrigger>
          <CampaignDialog mode="create" onDone={() => { setShowCreate(false); load(); }} />
        </Dialog>
      </div>

      {error && (
        <Card className="mb-4 border-destructive/40"><CardContent className="flex items-center justify-between p-4 text-sm">
          <span className="text-destructive">{error}</span>
          <Button size="sm" variant="outline" onClick={load}>Retry</Button>
        </CardContent></Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Campaign</TableHead><TableHead>Status</TableHead><TableHead>Window</TableHead>
                <TableHead className="text-right">Codes</TableHead>
                <TableHead className="text-right">Referrals</TableHead>
                <TableHead className="text-right">Successful</TableHead>
                <TableHead className="text-right">Conversion</TableHead>
                <TableHead className="text-right">Bonuses</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={10} className="p-8 text-center text-sm text-muted-foreground">Loading campaigns…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="p-10 text-center">
                    <Trophy className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium">No campaigns yet</p>
                    <p className="text-sm text-muted-foreground">Create a campaign, then assign referral codes to it from the Referral Program page.</p>
                  </TableCell></TableRow>
                ) : rows.map(({ c, s }) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="max-w-[240px] truncate text-xs text-muted-foreground">{c.description ?? c.prize}</div>
                    </TableCell>
                    <TableCell><Badge variant={statusVariant(c.status)}>{c.status}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{shortDate(c.starts_at)} → {shortDate(c.ends_at)}</TableCell>
                    <TableCell className="text-right text-sm">{s.activeCodes}/{s.codes}</TableCell>
                    <TableCell className="text-right text-sm">{s.referrals}</TableCell>
                    <TableCell className="text-right text-sm">{s.successful}</TableCell>
                    <TableCell className="text-right text-sm">{s.referrals ? Math.round((s.successful / s.referrals) * 100) : 0}%</TableCell>
                    <TableCell className="text-right text-sm">{usd(s.bonus)}</TableCell>
                    <TableCell className="text-right text-sm">{usd(s.commission)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <DetailsButton campaign={c} stats={s} codes={codes} />
                        <EditButton campaign={c} onDone={load} />
                        {c.status === "active" ? (
                          <Button variant="ghost" size="icon" title="Disable" onClick={() => setStatus(c.id, "disabled")}><PowerOff className="h-4 w-4" /></Button>
                        ) : (
                          <Button variant="ghost" size="icon" title="Activate" onClick={() => setStatus(c.id, "active")}><Power className="h-4 w-4" /></Button>
                        )}
                        <Button variant="ghost" size="icon" title="Archive" disabled={c.status === "archived"} onClick={() => setStatus(c.id, "archived")}><Archive className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AdminShell>
  );
}

function EditButton({ campaign, onDone }: { campaign: Campaign; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" title="Edit"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
      <CampaignDialog mode="edit" campaign={campaign} onDone={() => { setOpen(false); onDone(); }} />
    </Dialog>
  );
}

function DetailsButton({ campaign, stats, codes }: { campaign: Campaign; stats: Stats; codes: CodeRow[] }) {
  const [open, setOpen] = useState(false);
  const mine = codes.filter(c => (c.campaign_name ?? "").toLowerCase() === campaign.name.toLowerCase());
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" title="View details"><Eye className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{campaign.name}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
            <Badge variant="outline">{campaign.eligibility}</Badge>
            <Badge variant="secondary">{campaign.winner_count} winner{campaign.winner_count === 1 ? "" : "s"}</Badge>
          </div>
          <p className="text-muted-foreground">{campaign.description ?? "No description."}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Prize" value={campaign.prize} />
            <Info label="Window" value={`${shortDate(campaign.starts_at)} → ${shortDate(campaign.ends_at)}`} />
            <Info label="Total codes" value={String(stats.codes)} />
            <Info label="Active codes" value={String(stats.activeCodes)} />
            <Info label="Total referrals" value={String(stats.referrals)} />
            <Info label="Successful referrals" value={String(stats.successful)} />
            <Info label="Conversion rate" value={`${stats.referrals ? Math.round((stats.successful / stats.referrals) * 100) : 0}%`} />
            <Info label="Leaderboard codes" value={`${stats.leaderboard} of ${stats.codes}`} />
            <Info label="Welcome bonuses paid" value={usd(stats.bonus)} />
            <Info label="Commissions paid" value={usd(stats.commission)} />
          </div>
          <div>
            <p className="mb-2 font-medium">Codes in this campaign</p>
            {mine.length === 0 ? (
              <p className="rounded-md border p-3 text-xs text-muted-foreground">
                No codes assigned yet. Set the campaign name to “{campaign.name}” when creating or editing a referral code.
              </p>
            ) : (
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Code</TableHead><TableHead>Owner</TableHead>
                    <TableHead className="text-right">Referrals</TableHead><TableHead className="text-right">Commission</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {mine.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.code}</TableCell>
                        <TableCell className="text-xs">{c.owner_full_name ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">{c.users_referred}</TableCell>
                        <TableCell className="text-right text-xs">{usd(c.total_commission_cents)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function CampaignDialog({ mode, campaign, onDone }: { mode: "create" | "edit"; campaign?: Campaign; onDone: () => void }) {
  const { user } = useSession();
  const [name, setName] = useState(campaign?.name ?? "");
  const [description, setDescription] = useState(campaign?.description ?? "");
  const [prize, setPrize] = useState(campaign?.prize ?? "");
  const [winners, setWinners] = useState(String(campaign?.winner_count ?? 1));
  const [eligibility, setEligibility] = useState(campaign?.eligibility ?? "All partners with an active referral code");
  const [starts, setStarts] = useState((campaign?.starts_at ?? new Date().toISOString()).slice(0, 10));
  const [ends, setEnds] = useState((campaign?.ends_at ?? new Date(Date.now() + 30 * 864e5).toISOString()).slice(0, 10));
  const [status, setStatus] = useState(campaign?.status ?? "draft");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return toast.error("Campaign name is required");
    if (!prize.trim()) return toast.error("Prize is required");
    if (new Date(ends) < new Date(starts)) return toast.error("End date must be after the start date");
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      prize: prize.trim(),
      winner_count: Math.max(1, parseInt(winners, 10) || 1),
      eligibility: eligibility.trim(),
      starts_at: new Date(`${starts}T00:00:00`).toISOString(),
      ends_at: new Date(`${ends}T23:59:59`).toISOString(),
      status,
    };
    const { error } = mode === "create"
      ? await supabase.from("referral_campaigns").insert({ ...payload, created_by: user?.id ?? null })
      : await supabase.from("referral_campaigns").update(payload).eq("id", campaign!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(mode === "create" ? "Campaign created" : "Campaign updated");
    onDone();
  }

  return (
    <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
      <DialogHeader><DialogTitle>{mode === "create" ? "Create campaign" : `Edit ${campaign?.name}`}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Campaign name</Label>
          <Input className="mt-1.5" value={name} onChange={e => setName(e.target.value)} placeholder="Summer Ambassadors 2026" />
          <p className="mt-1 text-xs text-muted-foreground">Referral codes join this campaign by using the exact same campaign name.</p>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea className="mt-1.5" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Start date</Label><Input className="mt-1.5" type="date" value={starts} onChange={e => setStarts(e.target.value)} /></div>
          <div><Label>End date</Label><Input className="mt-1.5" type="date" value={ends} onChange={e => setEnds(e.target.value)} /></div>
          <div><Label>Prize</Label><Input className="mt-1.5" value={prize} onChange={e => setPrize(e.target.value)} placeholder="$100 bonus" /></div>
          <div><Label>Winners</Label><Input className="mt-1.5" type="number" min={1} value={winners} onChange={e => setWinners(e.target.value)} /></div>
        </div>
        <div>
          <Label>Eligibility</Label>
          <Input className="mt-1.5" value={eligibility} onChange={e => setEligibility(e.target.value)} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Saving…" : mode === "create" ? "Create campaign" : "Save changes"}</Button></DialogFooter>
    </DialogContent>
  );
}

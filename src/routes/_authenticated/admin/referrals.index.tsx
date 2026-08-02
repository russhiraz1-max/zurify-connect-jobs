import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, Power, PowerOff, Trash2, UserCog, Pencil } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { shortDate, usd } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/referrals/")({
  head: () => ({
    meta: [
      { title: "Referral Program — Zurify Admin" },
      { name: "description", content: "Create, configure and monitor Zurify referral codes and partner campaigns." },
    ],
  }),
  component: AdminReferrals,
});

export type CodeRow = {
  id: string; code: string; owner_user_id: string; owner_full_name: string | null; owner_email: string | null;
  status: string; max_uses: number | null; total_uses: number; created_at: string;
  users_referred: number; pending_bonus_users: number; awarded_bonus_users: number;
  total_bonus_cents: number; total_commission_cents: number;
  campaign_name: string | null; description: string | null; expires_at: string | null;
  welcome_bonus_cents: number | null; commission_bps: number | null; min_withdrawal_cents: number | null;
  commission_duration_days: number | null; leaderboard_eligible: boolean; notes: string | null;
};

type UserSearchRow = { id: string; email: string; full_name: string | null; has_code: boolean };

export type GlobalDefaults = {
  referral_welcome_bonus_cents: number;
  referral_commission_bps: number;
  referral_min_withdrawal_cents: number;
  referral_code_length: number;
  referral_allowed_chars: string;
  referral_unlimited_uses: boolean;
  referral_default_max_uses: number | null;
};

export async function loadDefaults(): Promise<GlobalDefaults | null> {
  const { data } = await supabase
    .from("application_settings")
    .select("referral_welcome_bonus_cents,referral_commission_bps,referral_min_withdrawal_cents,referral_code_length,referral_allowed_chars,referral_unlimited_uses,referral_default_max_uses")
    .eq("singleton", true).maybeSingle();
  return (data ?? null) as GlobalDefaults | null;
}

function AdminReferrals() {
  const [rows, setRows] = useState<CodeRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [defaults, setDefaults] = useState<GlobalDefaults | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_referral_codes" as never);
    if (error) toast.error(error.message);
    setRows(((data ?? []) as unknown) as CodeRow[]);
    setLoading(false);
  }
  useEffect(() => { load(); loadDefaults().then(setDefaults); }, []);

  const filtered = rows.filter(r => {
    if (!q) return true;
    const s = q.toLowerCase();
    return r.code.toLowerCase().includes(s)
      || (r.owner_email ?? "").toLowerCase().includes(s)
      || (r.owner_full_name ?? "").toLowerCase().includes(s)
      || (r.campaign_name ?? "").toLowerCase().includes(s);
  });

  const totals = rows.reduce((acc, r) => ({
    codes: acc.codes + 1,
    active: acc.active + (r.status === "active" ? 1 : 0),
    users: acc.users + Number(r.users_referred),
    bonus: acc.bonus + Number(r.total_bonus_cents),
    commission: acc.commission + Number(r.total_commission_cents),
  }), { codes: 0, active: 0, users: 0, bonus: 0, commission: 0 });

  async function setStatus(id: string, status: "active" | "disabled") {
    const { error } = await supabase.rpc("admin_set_referral_status" as never, { _id: id, _status: status } as never);
    if (error) return toast.error(error.message);
    toast.success(`Code ${status}`);
    load();
  }

  async function del(id: string) {
    if (!confirm("Delete this referral code? Only allowed if it has zero uses.")) return;
    const { error } = await supabase.rpc("admin_delete_referral_code" as never, { _id: id } as never);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  return (
    <AdminShell title="Referral Program" subtitle="Create and configure referral codes for partners, ambassadors and creators.">
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Codes", value: totals.codes },
          { label: "Active", value: totals.active },
          { label: "Users referred", value: totals.users },
          { label: "Bonus paid", value: usd(totals.bonus) },
          { label: "Commission paid", value: usd(totals.commission) },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-xl font-semibold">{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by code, campaign, name or email" className="pl-9" />
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Create code</Button></DialogTrigger>
          <CodeDialog mode="create" defaults={defaults} onDone={() => { setShowCreate(false); load(); }} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead><TableHead>Owner</TableHead><TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Uses</TableHead><TableHead className="text-right">Referred</TableHead>
                  <TableHead className="text-right">Bonus</TableHead><TableHead className="text-right">Commission</TableHead>
                  <TableHead>Created</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={10} className="p-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="p-8 text-center text-sm text-muted-foreground">No referral codes match your search.</TableCell></TableRow>
                ) : filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link to="/admin/referrals/$id" params={{ id: r.id }} className="font-mono text-sm font-semibold hover:underline">{r.code}</Link>
                      {r.expires_at && <div className="text-xs text-muted-foreground">Expires {shortDate(r.expires_at)}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{r.owner_full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.owner_email}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.campaign_name ?? <span className="text-muted-foreground">—</span>}
                      {!r.leaderboard_eligible && <div className="text-xs text-muted-foreground">No leaderboard</div>}
                    </TableCell>
                    <TableCell><Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                    <TableCell className="text-right text-sm">{r.total_uses}{r.max_uses != null ? ` / ${r.max_uses}` : ""}</TableCell>
                    <TableCell className="text-right text-sm">{r.users_referred}</TableCell>
                    <TableCell className="text-right text-sm">{usd(r.total_bonus_cents)}</TableCell>
                    <TableCell className="text-right text-sm">{usd(r.total_commission_cents)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{shortDate(r.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <EditButton row={r} defaults={defaults} onDone={load} />
                        <ReassignButton id={r.id} onDone={load} />
                        {r.status === "active" ? (
                          <Button variant="ghost" size="icon" title="Disable" onClick={() => setStatus(r.id, "disabled")}><PowerOff className="h-4 w-4" /></Button>
                        ) : (
                          <Button variant="ghost" size="icon" title="Enable" onClick={() => setStatus(r.id, "active")}><Power className="h-4 w-4" /></Button>
                        )}
                        <Button variant="ghost" size="icon" title="Delete" onClick={() => del(r.id)} disabled={r.total_uses > 0}><Trash2 className="h-4 w-4" /></Button>
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

function UserPicker({ value, onChange }: { value: UserSearchRow | null; onChange: (u: UserSearchRow | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UserSearchRow[]>([]);
  useEffect(() => {
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("admin_search_users_for_referral" as never, { _q: q } as never);
      setResults(((data ?? []) as unknown) as UserSearchRow[]);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);
  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border p-2 text-sm">
        <div><div className="font-medium">{value.full_name ?? value.email}</div><div className="text-xs text-muted-foreground">{value.email}</div></div>
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>Change</Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Input placeholder="Search users by email or name" value={q} onChange={e => setQ(e.target.value)} />
      <div className="max-h-56 overflow-y-auto rounded-md border">
        {results.length === 0 ? (
          <div className="p-3 text-center text-xs text-muted-foreground">Type to search</div>
        ) : results.map(u => (
          <button key={u.id} type="button" onClick={() => onChange(u)}
            className="flex w-full items-center justify-between border-b p-2 text-left text-sm last:border-b-0 hover:bg-accent">
            <div>
              <div className="font-medium">{u.full_name ?? u.email}</div>
              <div className="text-xs text-muted-foreground">{u.email}</div>
            </div>
            {u.has_code && <Badge variant="secondary" className="text-xs">Has code</Badge>}
          </button>
        ))}
      </div>
    </div>
  );
}

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));
const dollarsToCents = (v: string) => (v.trim() === "" ? null : Math.round(parseFloat(v) * 100));
const centsToDollars = (v: number | null | undefined) => (v == null ? "" : (v / 100).toFixed(2));

function EditButton({ row, defaults, onDone }: { row: CodeRow; defaults: GlobalDefaults | null; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" title="Edit configuration"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
      <CodeDialog mode="edit" row={row} defaults={defaults} onDone={() => { setOpen(false); onDone(); }} />
    </Dialog>
  );
}

export function CodeDialog({ mode, row, defaults, onDone }:
  { mode: "create" | "edit"; row?: CodeRow; defaults: GlobalDefaults | null; onDone: () => void }) {
  const [owner, setOwner] = useState<UserSearchRow | null>(null);
  const [code, setCode] = useState(row?.code ?? "");
  const [campaign, setCampaign] = useState(row?.campaign_name ?? "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [bonus, setBonus] = useState(centsToDollars(row?.welcome_bonus_cents));
  const [commissionPct, setCommissionPct] = useState(row?.commission_bps != null ? String(row.commission_bps / 100) : "");
  const [minWithdrawal, setMinWithdrawal] = useState(centsToDollars(row?.min_withdrawal_cents));
  const [duration, setDuration] = useState(row?.commission_duration_days != null ? String(row.commission_duration_days) : "");
  const [expires, setExpires] = useState(row?.expires_at ? row.expires_at.slice(0, 10) : "");
  const [maxUses, setMaxUses] = useState(row?.max_uses != null ? String(row.max_uses) : "");
  const [leaderboard, setLeaderboard] = useState(row?.leaderboard_eligible ?? true);
  const [notes, setNotes] = useState(row?.notes ?? "");
  const [saving, setSaving] = useState(false);

  function randomCode() {
    const chars = defaults?.referral_allowed_chars || "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const len = defaults?.referral_code_length || 8;
    let s = "";
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    setCode(s);
  }

  async function save() {
    if (!code.trim()) return toast.error("Enter or generate a code");
    if (mode === "create" && !owner) return toast.error("Pick an owner");
    setSaving(true);
    const shared = {
      _code: code.trim().toUpperCase(),
      _max_uses: numOrNull(maxUses),
      _campaign_name: campaign.trim() || null,
      _description: description.trim() || null,
      _expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
      _welcome_bonus_cents: dollarsToCents(bonus),
      _commission_bps: commissionPct.trim() === "" ? null : Math.round(parseFloat(commissionPct) * 100),
      _min_withdrawal_cents: dollarsToCents(minWithdrawal),
      _commission_duration_days: numOrNull(duration),
      _leaderboard_eligible: leaderboard,
      _notes: notes.trim() || null,
    };
    const { error } = mode === "create"
      ? await supabase.rpc("admin_create_referral_code" as never, { _owner_user_id: owner!.id, ...shared } as never)
      : await supabase.rpc("admin_update_referral_code" as never, { _id: row!.id, ...shared } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(mode === "create" ? "Referral code created" : "Referral code updated");
    onDone();
  }

  const globalHint = (label: string) => `Global default: ${label}`;

  return (
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{mode === "create" ? "Create referral code" : `Edit ${row?.code}`}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        {mode === "create" ? (
          <div><Label>Owner</Label><div className="mt-1.5"><UserPicker value={owner} onChange={setOwner} /></div></div>
        ) : (
          <div className="rounded-md border p-2 text-sm">
            <div className="font-medium">{row?.owner_full_name ?? "—"}</div>
            <div className="text-xs text-muted-foreground">{row?.owner_email} · use the transfer button to reassign</div>
          </div>
        )}

        <div>
          <Label>Referral code</Label>
          <div className="mt-1.5 flex gap-2">
            <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. JOHN2026" />
            <Button type="button" variant="outline" onClick={randomCode}>Random</Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Campaign name</Label>
            <Input className="mt-1.5" value={campaign} onChange={e => setCampaign(e.target.value)} placeholder="Optional — e.g. Summer Ambassadors" />
          </div>
          <div>
            <Label>Expiry date</Label>
            <Input className="mt-1.5" type="date" value={expires} onChange={e => setExpires(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">{expires ? "Code stops working after this date." : "Blank — never expires."}</p>
          </div>
        </div>

        <div>
          <Label>Campaign description</Label>
          <Textarea className="mt-1.5" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Shown to the code owner on their referral dashboard." />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Welcome bonus (USD)</Label>
            <Input className="mt-1.5" type="number" step="0.01" min="0" value={bonus} onChange={e => setBonus(e.target.value)}
              placeholder={centsToDollars(defaults?.referral_welcome_bonus_cents) || "0.50"} />
            <p className="mt-1 text-xs text-muted-foreground">{bonus.trim() === "" ? globalHint(usd(defaults?.referral_welcome_bonus_cents ?? 0)) : "Overrides the global default."}</p>
          </div>
          <div>
            <Label>Commission (%)</Label>
            <Input className="mt-1.5" type="number" step="0.1" min="0" value={commissionPct} onChange={e => setCommissionPct(e.target.value)}
              placeholder={defaults ? String(defaults.referral_commission_bps / 100) : "10"} />
            <p className="mt-1 text-xs text-muted-foreground">{commissionPct.trim() === "" ? globalHint(`${(defaults?.referral_commission_bps ?? 0) / 100}%`) : "Overrides the global default."}</p>
          </div>
          <div>
            <Label>Minimum withdrawal before commission (USD)</Label>
            <Input className="mt-1.5" type="number" step="0.01" min="0" value={minWithdrawal} onChange={e => setMinWithdrawal(e.target.value)}
              placeholder={centsToDollars(defaults?.referral_min_withdrawal_cents) || "3.00"} />
            <p className="mt-1 text-xs text-muted-foreground">{minWithdrawal.trim() === "" ? globalHint(usd(defaults?.referral_min_withdrawal_cents ?? 0)) : "Overrides the global default."}</p>
          </div>
          <div>
            <Label>Commission duration (days)</Label>
            <Input className="mt-1.5" type="number" min="1" value={duration} onChange={e => setDuration(e.target.value)} placeholder="Unlimited" />
            <p className="mt-1 text-xs text-muted-foreground">{duration.trim() === "" ? "Blank — commission never expires." : `Commission stops ${duration} days after each signup.`}</p>
          </div>
          <div>
            <Label>Maximum uses</Label>
            <Input className="mt-1.5" type="number" min="1" value={maxUses} onChange={e => setMaxUses(e.target.value)}
              placeholder={defaults?.referral_unlimited_uses ? "Unlimited" : String(defaults?.referral_default_max_uses ?? "Unlimited")} />
            <p className="mt-1 text-xs text-muted-foreground">{maxUses.trim() === "" ? "Blank — uses the global default." : ""}</p>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Leaderboard eligible</Label>
              <p className="text-xs text-muted-foreground">Show this owner on the public leaderboard.</p>
            </div>
            <Switch checked={leaderboard} onCheckedChange={setLeaderboard} />
          </div>
        </div>

        <div>
          <Label>Internal notes</Label>
          <Textarea className="mt-1.5" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Staff-only notes. Never shown to the partner." />
        </div>

        {mode === "edit" && (
          <p className="text-xs text-muted-foreground">
            Status is {row?.status}. Use the power button in the table to activate or disable this code.
          </p>
        )}
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : mode === "create" ? "Create code" : "Save changes"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ReassignButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<UserSearchRow | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit() {
    if (!target) return;
    setSaving(true);
    const { error } = await supabase.rpc("admin_assign_referral_code" as never, { _id: id, _new_owner_user_id: target.id } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Ownership transferred");
    setOpen(false); setTarget(null); onDone();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" title="Reassign owner"><UserCog className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Transfer ownership</DialogTitle></DialogHeader>
        <UserPicker value={target} onChange={setTarget} />
        <DialogFooter><Button onClick={submit} disabled={!target || saving}>Transfer</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

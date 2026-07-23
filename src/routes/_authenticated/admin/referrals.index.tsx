import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, Power, PowerOff, Trash2, UserCog } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { shortDate, usd } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/referrals/")({
  head: () => ({ meta: [{ title: "Referral Program — Admin" }] }),
  component: AdminReferrals,
});

type Row = {
  id: string; code: string; owner_user_id: string; owner_full_name: string | null; owner_email: string | null;
  status: string; max_uses: number | null; total_uses: number; created_at: string;
  users_referred: number; pending_bonus_users: number; awarded_bonus_users: number;
  total_bonus_cents: number; total_commission_cents: number;
};

type UserSearchRow = { id: string; email: string; full_name: string | null; has_code: boolean };

function AdminReferrals() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_referral_codes" as never);
    if (error) toast.error(error.message);
    setRows(((data ?? []) as unknown) as Row[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => {
    if (!q) return true;
    const s = q.toLowerCase();
    return r.code.toLowerCase().includes(s) || (r.owner_email ?? "").toLowerCase().includes(s) || (r.owner_full_name ?? "").toLowerCase().includes(s);
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
    <AdminShell title="Referral Program" subtitle="Create and manage referral codes for partners, ambassadors and creators.">
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
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by code, name or email" className="pl-9" />
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Create code</Button></DialogTrigger>
          <CreateCodeDialog onDone={() => { setShowCreate(false); load(); }} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead><TableHead>Owner</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-right">Uses</TableHead><TableHead className="text-right">Referred</TableHead>
                <TableHead className="text-right">Bonus</TableHead><TableHead className="text-right">Commission</TableHead>
                <TableHead>Created</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="p-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="p-8 text-center text-sm text-muted-foreground">No referral codes yet.</TableCell></TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell><Link to="/admin/referrals/$id" params={{ id: r.id }} className="font-mono text-sm font-semibold hover:underline">{r.code}</Link></TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{r.owner_full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.owner_email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">{r.total_uses}{r.max_uses != null ? ` / ${r.max_uses}` : ""}</TableCell>
                  <TableCell className="text-right text-sm">{r.users_referred}</TableCell>
                  <TableCell className="text-right text-sm">{usd(r.total_bonus_cents)}</TableCell>
                  <TableCell className="text-right text-sm">{usd(r.total_commission_cents)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{shortDate(r.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
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

function CreateCodeDialog({ onDone }: { onDone: () => void }) {
  const [owner, setOwner] = useState<UserSearchRow | null>(null);
  const [code, setCode] = useState("");
  const [maxUses, setMaxUses] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<{ referral_code_length: number; referral_allowed_chars: string; referral_unlimited_uses: boolean; referral_default_max_uses: number | null } | null>(null);

  useEffect(() => {
    supabase.from("application_settings").select("referral_code_length,referral_allowed_chars,referral_unlimited_uses,referral_default_max_uses").eq("singleton", true).maybeSingle()
      .then(({ data }) => setSettings(data as never));
  }, []);

  function randomCode() {
    const chars = settings?.referral_allowed_chars || "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const len = settings?.referral_code_length || 8;
    let s = "";
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    setCode(s);
  }

  async function save() {
    if (!owner) return toast.error("Pick an owner");
    if (!code.trim()) return toast.error("Enter or generate a code");
    setSaving(true);
    const parsed = maxUses.trim() ? parseInt(maxUses, 10) : null;
    const { error } = await supabase.rpc("admin_create_referral_code" as never, {
      _owner_user_id: owner.id, _code: code.trim().toUpperCase(), _max_uses: parsed,
    } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Referral code created");
    onDone();
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Create referral code</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div><Label>Owner</Label><div className="mt-1.5"><UserPicker value={owner} onChange={setOwner} /></div></div>
        <div>
          <Label>Code</Label>
          <div className="mt-1.5 flex gap-2">
            <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. JOHN2026" />
            <Button type="button" variant="outline" onClick={randomCode}>Random</Button>
          </div>
        </div>
        <div>
          <Label>Max uses (leave empty for unlimited)</Label>
          <Input type="number" min={1} value={maxUses} onChange={e => setMaxUses(e.target.value)} className="mt-1.5" placeholder={settings?.referral_unlimited_uses ? "Unlimited" : String(settings?.referral_default_max_uses ?? "")} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>{saving ? "Creating…" : "Create code"}</Button>
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

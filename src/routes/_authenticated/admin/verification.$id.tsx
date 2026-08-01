import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, ZoomIn, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { usd, dateTime, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/verification/$id")({
  head: () => ({ meta: [{ title: "Verification review — Admin" }] }),
  component: KycReview,
});

type Detail = {
  id: string; user_id: string; status: string;
  id_front_path: string; id_back_path: string; selfie_path: string;
  paypal_email: string; phone: string; admin_notes: string | null; rejection_reason: string | null;
  created_at: string; reviewed_at: string | null;
  user: {
    full_name: string | null; email: string | null; joined_at: string; suspended: boolean;
    withdrawal_hold: boolean; available_cents: number; pending_withdrawal_cents: number;
    lifetime_earned_cents: number; lifetime_withdrawn_cents: number; approved_tasks: number;
  } | null;
  withdrawals: { id: string; amount_cents: number; net_cents: number; status: string; created_at: string }[];
  activity: { action: string; created_at: string }[];
  referral: { code: string; applied_at: string; bonus_awarded_at: string | null } | null;
};

function KycReview() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [d, setD] = useState<Detail | null>(null);
  const [urls, setUrls] = useState<{ front?: string; back?: string; selfie?: string }>({});
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await supabase.rpc("admin_kyc_detail" as never, { _id: id } as never);
    if (error) { toast.error(error.message); return; }
    const detail = (data as unknown) as Detail;
    setD(detail);
    setNotes(detail.admin_notes ?? "");
    const signed = await supabase.storage.from("kyc-documents")
      .createSignedUrls([detail.id_front_path, detail.id_back_path, detail.selfie_path], 300);
    const s = signed.data ?? [];
    setUrls({ front: s[0]?.signedUrl ?? undefined, back: s[1]?.signedUrl ?? undefined, selfie: s[2]?.signedUrl ?? undefined });
  }
  useEffect(() => { load(); }, [id]);

  async function approve() {
    setBusy(true);
    const { error } = await supabase.rpc("admin_approve_kyc" as never, { _id: id, _notes: notes || null } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Verification approved");
    navigate({ to: "/admin/verification" });
  }

  async function reject() {
    if (!reason.trim()) return toast.error("Rejection reason is required");
    setBusy(true);
    const { error } = await supabase.rpc("admin_reject_kyc" as never, { _id: id, _reason: reason.trim() } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Verification rejected");
    setRejectOpen(false);
    navigate({ to: "/admin/verification" });
  }

  if (!d) return <AdminShell title="Verification review"><Card><CardContent className="p-6">Loading…</CardContent></Card></AdminShell>;

  const accountAgeDays = d.user ? Math.max(0, Math.floor((Date.now() - new Date(d.user.joined_at).getTime()) / 86400000)) : 0;

  return (
    <AdminShell title="Verification review" subtitle={d.user?.email ?? undefined}>
      <div className="mb-4 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm"><Link to="/admin/verification"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back</Link></Button>
        <Badge variant={d.status === "approved" ? "default" : d.status === "rejected" ? "destructive" : "secondary"}>{d.status}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card><CardContent className="space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Documents</h2>
            <p className="text-xs text-muted-foreground">Links are signed and expire after 5 minutes. Files are never publicly accessible.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <DocTile label="Government ID — front" url={urls.front} onZoom={setZoom} />
              <DocTile label="Government ID — back" url={urls.back} onZoom={setZoom} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Live selfie</p>
              {urls.selfie ? (
                <div className="overflow-hidden rounded-lg border">
                  <img src={urls.selfie} alt="Applicant live selfie" className="mx-auto max-h-[28rem]" />
                  <div className="flex gap-2 border-t p-2">
                    <Button size="sm" variant="outline" onClick={() => setZoom(urls.selfie!)}><ZoomIn className="mr-1.5 h-3.5 w-3.5" /> Zoom</Button>
                    <Button asChild size="sm" variant="outline"><a href={urls.selfie} download target="_blank" rel="noreferrer"><Download className="mr-1.5 h-3.5 w-3.5" /> Download</a></Button>
                  </div>
                </div>
              ) : <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Loading image…</div>}
            </div>
          </CardContent></Card>

          <Card><CardContent className="space-y-3 p-6">
            <h2 className="font-display text-lg font-semibold">Withdrawal history</h2>
            {d.withdrawals.length === 0 ? <p className="text-sm text-muted-foreground">No withdrawal requests yet.</p> : (
              <ul className="divide-y text-sm">
                {d.withdrawals.map(w => (
                  <li key={w.id} className="flex items-center justify-between py-2">
                    <span>{usd(w.amount_cents)} <span className="text-muted-foreground">→ net {usd(w.net_cents)}</span></span>
                    <span className="flex items-center gap-3"><Badge variant="secondary">{w.status}</Badge>
                      <span className="text-xs text-muted-foreground">{shortDate(w.created_at)}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent></Card>

          <Card><CardContent className="space-y-3 p-6">
            <h2 className="font-display text-lg font-semibold">Recent activity</h2>
            {d.activity.length === 0 ? <p className="text-sm text-muted-foreground">No recorded activity.</p> : (
              <ul className="divide-y text-sm">
                {d.activity.map((a, i) => (
                  <li key={i} className="flex items-center justify-between py-2">
                    <span className="font-mono text-xs text-muted-foreground">{a.action}</span>
                    <span className="text-xs text-muted-foreground">{dateTime(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent></Card>
        </div>

        <div className="space-y-6">
          <Card><CardContent className="space-y-2 p-6 text-sm">
            <h2 className="font-display text-lg font-semibold">User</h2>
            <Row k="Name" v={d.user?.full_name ?? "Member"} />
            <Row k="Email" v={d.user?.email ?? "—"} />
            <Row k="Phone" v={d.phone} />
            <Row k="PayPal" v={d.paypal_email} />
            <Row k="Joined" v={shortDate(d.user?.joined_at)} />
            <Row k="Account age" v={`${accountAgeDays} days`} />
            <Row k="Approved tasks" v={String(d.user?.approved_tasks ?? 0)} />
            <Row k="Wallet available" v={usd(d.user?.available_cents)} />
            <Row k="Reserved" v={usd(d.user?.pending_withdrawal_cents)} />
            <Row k="Lifetime earned" v={usd(d.user?.lifetime_earned_cents)} />
            <Row k="Lifetime withdrawn" v={usd(d.user?.lifetime_withdrawn_cents)} />
            <Row k="Suspended" v={d.user?.suspended ? "Yes" : "No"} />
            <Row k="Withdrawal hold" v={d.user?.withdrawal_hold ? "Yes" : "No"} />
            <Button asChild variant="outline" size="sm" className="mt-2 w-full">
              <Link to="/admin/users"><ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View user</Link>
            </Button>
          </CardContent></Card>

          <Card><CardContent className="space-y-2 p-6 text-sm">
            <h2 className="font-display text-lg font-semibold">Referral</h2>
            {d.referral ? (
              <>
                <Row k="Code used" v={d.referral.code} />
                <Row k="Applied" v={shortDate(d.referral.applied_at)} />
                <Row k="Welcome bonus" v={d.referral.bonus_awarded_at ? "Awarded" : "Pending"} />
              </>
            ) : <p className="text-muted-foreground">No referral code applied.</p>}
          </CardContent></Card>

          <Card><CardContent className="space-y-3 p-6">
            <Label>Administrator notes</Label>
            <Textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes about this review" />
            {d.status === "pending" ? (
              <div className="flex gap-2">
                <Button onClick={approve} disabled={busy} className="flex-1"><CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve</Button>
                <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={busy} className="flex-1"><XCircle className="mr-1.5 h-4 w-4" /> Reject</Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Reviewed {d.reviewed_at ? dateTime(d.reviewed_at) : "—"}{d.rejection_reason ? ` — ${d.rejection_reason}` : ""}
              </p>
            )}
          </CardContent></Card>
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reject verification</DialogTitle></DialogHeader>
          <Textarea rows={4} value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain what the user must fix (visible to them)" />
          <DialogFooter><Button variant="destructive" onClick={reject} disabled={busy}>Reject & notify</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!zoom} onOpenChange={o => !o && setZoom(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Document preview</DialogTitle></DialogHeader>
          {zoom && <img src={zoom} alt="Verification document enlarged" className="max-h-[75vh] w-full object-contain" />}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function DocTile({ label, url, onZoom }: { label: string; url?: string; onZoom: (u: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      {url ? (
        <div className="overflow-hidden rounded-lg border">
          <img src={url} alt={label} className="mx-auto max-h-56 object-contain" />
          <div className="flex gap-2 border-t p-2">
            <Button size="sm" variant="outline" onClick={() => onZoom(url)}><ZoomIn className="mr-1.5 h-3.5 w-3.5" /> Zoom</Button>
            <Button asChild size="sm" variant="outline"><a href={url} download target="_blank" rel="noreferrer"><Download className="mr-1.5 h-3.5 w-3.5" /> Download</a></Button>
          </div>
        </div>
      ) : <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Loading image…</div>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span></div>;
}

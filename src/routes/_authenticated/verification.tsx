import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Clock, CheckCircle2, XCircle, Camera, Upload, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/verification")({
  head: () => ({ meta: [{ title: "Identity verification — Zurify" }] }),
  component: VerificationPage,
});

export type KycRow = {
  id: string; status: "pending" | "approved" | "rejected"; paypal_email: string; phone: string;
  rejection_reason: string | null; created_at: string; reviewed_at: string | null;
};

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

function VerificationPage() {
  const { user } = useSession();
  const [kyc, setKyc] = useState<KycRow | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.rpc("get_my_kyc" as never);
    const arr = ((data ?? []) as unknown) as KycRow[];
    setKyc(arr[0] ?? null);
    setLoading(false);
  }
  useEffect(() => { if (user) load(); }, [user?.id]);

  if (loading) {
    return <AppShell title="Identity verification"><Card><CardContent className="p-6">Loading…</CardContent></Card></AppShell>;
  }

  const status = kyc?.status ?? "not_started";

  return (
    <AppShell title="Identity verification" subtitle="A one-time check required before your first withdrawal is paid.">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <StatusCard kyc={kyc} />
          {(status === "not_started" || status === "rejected") && (
            <KycForm onSubmitted={() => { setLoading(true); load(); }} />
          )}
          {status === "approved" && (
            <Card><CardContent className="p-6">
              <p className="text-sm">You're verified. You can now request and receive withdrawals.</p>
              <Button asChild className="mt-4"><Link to="/withdrawals/new">Request a withdrawal</Link></Button>
            </CardContent></Card>
          )}
        </div>
        <Card className="h-fit"><CardContent className="space-y-3 p-6 text-sm">
          <h2 className="font-display text-base font-semibold">Why we verify</h2>
          <p className="text-muted-foreground">Verification confirms you are a real person and that payouts reach the right PayPal account.</p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>Required <strong className="text-foreground">only once</strong> — never again after approval.</li>
            <li>Protects your balance from account takeover and payout fraud.</li>
            <li>Documents are stored in a private, encrypted bucket. They are never public and are only visible to authorised reviewers through short-lived links.</li>
            <li>Typical review time: <strong className="text-foreground">up to 48 hours</strong>.</li>
          </ul>
        </CardContent></Card>
      </div>
    </AppShell>
  );
}

function StatusCard({ kyc }: { kyc: KycRow | null }) {
  const status = kyc?.status ?? "not_started";
  const map = {
    not_started: { label: "Not started", icon: ShieldCheck, tone: "secondary" as const, text: "You haven't submitted your documents yet." },
    pending: { label: "Pending review", icon: Clock, tone: "secondary" as const, text: "Your documents are with our review team. This usually takes up to 48 hours." },
    approved: { label: "Approved", icon: CheckCircle2, tone: "default" as const, text: "Your identity has been verified." },
    rejected: { label: "Rejected", icon: XCircle, tone: "destructive" as const, text: "Your submission was rejected. Please review the reason and submit again." },
  }[status];
  const Icon = map.icon;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-brand-gradient text-primary-foreground"><Icon className="h-5 w-5" /></div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-display text-lg font-semibold">Verification status</p>
              <Badge variant={map.tone}>{map.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{map.text}</p>
          </div>
        </div>
        {kyc && (
          <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
            <div>Submitted: {dateTime(kyc.created_at)}</div>
            {kyc.reviewed_at && <div>Reviewed: {dateTime(kyc.reviewed_at)}</div>}
            <div>PayPal: {kyc.paypal_email}</div>
            <div>Phone: {kyc.phone}</div>
          </div>
        )}
        {kyc?.status === "rejected" && kyc.rejection_reason && (
          <Alert variant="destructive"><AlertDescription className="text-sm">Reason: {kyc.rejection_reason}</AlertDescription></Alert>
        )}
      </CardContent>
    </Card>
  );
}

function KycForm({ onSubmitted }: { onSubmitted: () => void }) {
  const { user } = useSession();
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<Blob | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [paypal, setPaypal] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  function pick(setter: (f: File | null) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      if (!f) return setter(null);
      if (!ALLOWED.includes(f.type)) { toast.error("Use a JPG, PNG or WEBP image"); return; }
      if (f.size > MAX_BYTES) { toast.error("File must be under 8 MB"); return; }
      setter(f);
    };
  }

  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(paypal);
  const validPhone = /^[+\d][\d\s()-]{6,19}$/.test(phone);
  const ready = !!front && !!back && !!selfie && validEmail && validPhone && confirmed && !busy;

  async function submit() {
    if (!user || !front || !back || !selfie) return;
    setBusy(true); setProgress(10);
    const stamp = Date.now();
    const ext = (f: File) => (f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg");
    const paths = {
      front: `${user.id}/${stamp}-id-front.${ext(front)}`,
      back: `${user.id}/${stamp}-id-back.${ext(back)}`,
      selfie: `${user.id}/${stamp}-selfie.jpg`,
    };
    try {
      const up = async (path: string, body: Blob, type: string, next: number) => {
        const { error } = await supabase.storage.from("kyc-documents").upload(path, body, { contentType: type, upsert: false });
        if (error) throw error;
        setProgress(next);
      };
      await up(paths.front, front, front.type, 35);
      await up(paths.back, back, back.type, 60);
      await up(paths.selfie, selfie, "image/jpeg", 85);
      const { error } = await supabase.rpc("submit_kyc" as never, {
        _id_front: paths.front, _id_back: paths.back, _selfie: paths.selfie,
        _paypal_email: paypal.trim(), _phone: phone.trim(),
      } as never);
      if (error) throw error;
      setProgress(100);
      toast.success("Verification submitted — we'll review it within 48 hours");
      onSubmitted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
      setProgress(0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <h2 className="font-display text-lg font-semibold">Submit your documents</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="front">Government ID — front</Label>
            <Input id="front" type="file" accept="image/jpeg,image/png,image/webp" onChange={pick(setFront)} className="mt-1.5" />
            {front && <p className="mt-1 text-xs text-muted-foreground">{front.name}</p>}
          </div>
          <div>
            <Label htmlFor="back">Government ID — back</Label>
            <Input id="back" type="file" accept="image/jpeg,image/png,image/webp" onChange={pick(setBack)} className="mt-1.5" />
            {back && <p className="mt-1 text-xs text-muted-foreground">{back.name}</p>}
          </div>
        </div>

        <SelfieCapture
          previewUrl={selfieUrl}
          onCapture={(blob, url) => { setSelfie(blob); setSelfieUrl(url); }}
          onReset={() => { setSelfie(null); setSelfieUrl(null); }}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pp">PayPal email</Label>
            <Input id="pp" type="email" value={paypal} onChange={e => setPaypal(e.target.value)} placeholder="you@example.com" className="mt-1.5" />
            {paypal && !validEmail && <p className="mt-1 text-xs text-destructive">Enter a valid email.</p>}
          </div>
          <div>
            <Label htmlFor="ph">Phone number</Label>
            <Input id="ph" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 123 4567" className="mt-1.5" />
            {phone && !validPhone && <p className="mt-1 text-xs text-destructive">Enter a valid phone number.</p>}
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
          <Checkbox checked={confirmed} onCheckedChange={v => setConfirmed(v === true)} className="mt-0.5" />
          <span className="text-muted-foreground">
            I confirm these documents are mine, unedited, and that the PayPal email above is the account I want to be paid on.
          </span>
        </label>

        {busy && <div><Progress value={progress} /><p className="mt-1 text-xs text-muted-foreground">Uploading securely… {progress}%</p></div>}

        <Button onClick={submit} disabled={!ready} className="w-full">
          <Upload className="mr-2 h-4 w-4" /> Submit for verification
        </Button>
      </CardContent>
    </Card>
  );
}

function SelfieCapture({ previewUrl, onCapture, onReset }: {
  previewUrl: string | null;
  onCapture: (blob: Blob, url: string) => void;
  onReset: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 1280, height: 720 }, audio: false });
      streamRef.current = stream;
      setLive(true);
      requestAnimationFrame(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); } });
    } catch {
      toast.error("Camera unavailable. Allow camera access to take your live selfie.");
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setLive(false);
  }

  function shoot() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 640;
    canvas.height = v.videoHeight || 480;
    canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) return toast.error("Could not capture the photo");
      onCapture(blob, URL.createObjectURL(blob));
      stop();
    }, "image/jpeg", 0.9);
  }

  return (
    <div>
      <Label>Live selfie</Label>
      <p className="mt-0.5 text-xs text-muted-foreground">Taken with your device camera — uploads from your gallery are not accepted here.</p>
      <div className="mt-2 overflow-hidden rounded-lg border bg-surface-muted/40">
        {previewUrl ? (
          <img src={previewUrl} alt="Captured selfie preview" className="mx-auto max-h-72" />
        ) : live ? (
          <video ref={videoRef} playsInline muted className="mx-auto max-h-72 w-full object-contain" />
        ) : (
          <div className="grid place-items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <Camera className="h-8 w-8" />
            Start your camera to take a live selfie.
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        {previewUrl ? (
          <Button type="button" variant="outline" size="sm" onClick={onReset}><RefreshCw className="mr-2 h-4 w-4" /> Retake</Button>
        ) : live ? (
          <>
            <Button type="button" size="sm" onClick={shoot}><Camera className="mr-2 h-4 w-4" /> Capture</Button>
            <Button type="button" variant="ghost" size="sm" onClick={stop}>Cancel</Button>
          </>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={start}><Camera className="mr-2 h-4 w-4" /> Start camera</Button>
        )}
      </div>
    </div>
  );
}

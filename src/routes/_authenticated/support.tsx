import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({ meta: [{ title: "Support — Zurify" }] }),
  component: SupportPage,
});

type Ticket = { id: string; subject: string; status: string; created_at: string; updated_at: string };
type Message = { id: string; author_id: string; body: string; created_at: string; is_staff_reply: boolean };

function SupportPage() {
  const { user } = useSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("support_tickets").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
    setTickets((data ?? []) as Ticket[]);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  async function openTicket(id: string) {
    setOpenId(id);
    const { data } = await supabase.from("support_ticket_messages").select("*").eq("ticket_id", id).order("created_at");
    setMessages((data ?? []) as Message[]);
  }

  async function create() {
    if (!user || !subject.trim() || !body.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.from("support_tickets").insert({ user_id: user.id, subject }).select("id").single();
    if (error || !data) { setBusy(false); return toast.error(error?.message ?? "Failed"); }
    await supabase.from("support_ticket_messages").insert({ ticket_id: data.id, author_id: user.id, body });
    setBusy(false);
    setSubject(""); setBody("");
    toast.success("Ticket created");
    load();
  }

  async function sendReply() {
    if (!user || !openId || !reply.trim()) return;
    const { error } = await supabase.from("support_ticket_messages").insert({ ticket_id: openId, author_id: user.id, body: reply });
    if (error) return toast.error(error.message);
    setReply("");
    openTicket(openId);
  }

  return (
    <AppShell title="Support" subtitle="Get help from our team.">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="font-semibold">Create a ticket</h2>
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="body">Message</Label>
              <Textarea id="body" rows={5} value={body} onChange={e => setBody(e.target.value)} />
            </div>
            <Button onClick={create} disabled={busy || !subject.trim() || !body.trim()}>Create ticket</Button>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h2 className="font-semibold">Your tickets</h2>
          {tickets.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No tickets yet.</CardContent></Card>
          ) : tickets.map(t => (
            <Dialog key={t.id} open={openId === t.id} onOpenChange={o => o ? openTicket(t.id) : setOpenId(null)}>
              <DialogTrigger asChild>
                <Card className="cursor-pointer hover:bg-accent/40">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{t.subject}</p>
                      <p className="text-xs text-muted-foreground">{dateTime(t.updated_at)}</p>
                    </div>
                    <Badge variant={t.status === "resolved" ? "default" : "secondary"}>{t.status}</Badge>
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>{t.subject}</DialogTitle></DialogHeader>
                <div className="max-h-80 space-y-3 overflow-y-auto">
                  {messages.map(m => (
                    <div key={m.id} className={`rounded-md p-3 text-sm ${m.author_id === user?.id ? "bg-primary/10" : "bg-accent"}`}>
                      <p className="whitespace-pre-line">{m.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{dateTime(m.created_at)}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Textarea placeholder="Reply…" rows={3} value={reply} onChange={e => setReply(e.target.value)} />
                  <Button onClick={sendReply} disabled={!reply.trim()}>Send</Button>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
